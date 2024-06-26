import { Timestamp } from "firebase/firestore";
import { computed, makeObservable, observable } from "mobx";

import { ExperimentService } from "./experiment_service";
import { FirebaseService } from "./firebase_service";
import { LLMService } from "./llm_service";
import { ParticipantService } from "./participant_service";
import { RouterService } from "./router_service";
import { Service } from "./service";

import { ChatAnswer, ChatKind, MediatorConfig, MediatorKind, Message, MessageKind, StageKind, } from "@llm-mediation-experiments/utils";
import { Unsubscribe, collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { createMessageCallable } from "../shared/callables";
import { createChatMediatorPrompt } from "../shared/prompts";
import { collectSnapshotWithId } from "../shared/utils";

interface ServiceProvider {
  firebaseService: FirebaseService;
  experimentService: ExperimentService;
  llmService: LLMService;
  participantService: ParticipantService;
  routerService: RouterService;
}

export class ChatService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);
  }


  @observable experimentId: string | null = null;
  @observable participantId: string | null = null;
  @observable chatId: string | null = null;

  @observable chat: ChatAnswer | undefined = undefined;
  @observable mediators: MediatorConfig[] = [];
  @observable messages: Message[] = [];

  // Loading
  @observable unsubscribe: Unsubscribe[] = [];
  @observable isConfigLoading = false;
  @observable areMessagesLoading = false;

  @computed get isLoading() {
    return this.isConfigLoading || this.areMessagesLoading;
  }

  set isLoading(value: boolean) {
    this.isConfigLoading = value;
    this.areMessagesLoading = value;
  }

  setChat(experimentId: string | null, participantId: string | null, chatId: string | null) {
    this.experimentId = experimentId;
    this.participantId = participantId;
    this.chatId = chatId;
    this.isLoading = true;
    this.loadChatData();
  }

  setMediators(mediators: MediatorConfig[]) {
    this.mediators = mediators;
    console.log('mediators', this.mediators);
  }

  updateForCurrentRoute(chatId: string) {
    const eid = this.sp.routerService.activeRoute.params["experiment"];
    const pid = this.sp.routerService.activeRoute.params["participant"];
    const stageName = this.sp.routerService.activeRoute.params["stage"];

    if (eid !== this.experimentId || pid !== this.participantId
      || chatId !== this.chatId) {
      this.setChat(eid, pid, chatId);

      const stage = this.sp.experimentService.getStage(stageName);
      if (stage?.kind === StageKind.GroupChat) {
        this.setMediators(stage.mediators)
      }
    }
  }

  loadChatData() {
    this.unsubscribeAll();

    if (this.experimentId === null || this.participantId === null || this.chatId === null) {
      this.isLoading = false;
      return;
    }

    // Subscribe to the participant chat config
    this.unsubscribe.push(
      onSnapshot(
        doc(this.sp.firebaseService.firestore, 'experiments', this.experimentId, 'participants', this.participantId, 'chats', this.chatId),
        (doc) => {
          this.chat = doc.data() as ChatAnswer;
          this.isConfigLoading = false;
        },
      ),
    );

    // Subscribe to the chat messages
    this.unsubscribe.push(
      onSnapshot(
        query(
          collection(
            this.sp.firebaseService.firestore,
            'experiments',
            this.experimentId,
            'participants',
            this.participantId,
            'chats',
            this.chatId,
            'messages',
          ),
          orderBy('timestamp', 'desc'),
        ),
        (snapshot) => {
          // Note that Firestore will send incremental updates. The full list of messages can be reconstructed easily from the snapshot.
          this.messages = collectSnapshotWithId<Message>(snapshot, 'uid').reverse();
          this.areMessagesLoading = false;
        },
      ),
    );
  }

  unsubscribeAll() {
    this.unsubscribe.forEach((unsubscribe) => unsubscribe());
    this.unsubscribe = [];

    this.chat = undefined;
    this.messages = [];
  }

  getCurrentRatingIndex() {
    // Default return value when chat is still loading
    if (!this.chat) {
      return -1;
    }

    const stageData = this.sp.experimentService.getPublicStageData(
      this.chat.stageName
    );
    if (
      !stageData || stageData.kind !== StageKind.GroupChat ||
      stageData.chatData.kind !== ChatKind.ChatAboutItems
    ) {
      return -1;
    }

    return stageData.chatData.currentRatingIndex;
  }

  // ******************************************************************************************* //
  //                                          MUTATIONS                                          //
  // ******************************************************************************************* //

  /** Mark this participant as ready to end the chat, or ready to discuss about the next pair of items.
   * @rights Participant
   */
  async markReadyToEndChat(readyToEndChat: boolean) {
    return updateDoc(
      doc(
        this.sp.firebaseService.firestore,
        'experiments',
        this.experimentId!,
        'participants',
        this.participantId!,
        'chats',
        this.chatId!,
      ),
      {
        readyToEndChat,
      },
    );
  }

  /** Send a message as a participant.
   * @rights Participant
   */
  async sendUserMessage(text: string) {
    const messages = this.messages;

    createMessageCallable(
      this.sp.firebaseService.functions,
      {
      chatId: this.chatId!,
      experimentId: this.experimentId!,
      message: {
        kind: MessageKind.UserMessage,
        fromPrivateParticipantId: this.participantId!,
        text,
      },
    });

    // Generate LLM message
    // Add new message to previous messages
    messages.push({
      uid: '',
      timestamp: Timestamp.now(),
      kind: MessageKind.UserMessage,
      fromPublicParticipantId: this.sp.participantService.profile?.publicId!,
      text,
    });

    // Only send LLM message if no new messages have been sent
    const canSend = () => {
      return this.messages.length <= messages.length;
    }

    // For all automatic mediators, generate messages
    this.mediators.forEach(mediator => {
      if (mediator.kind === MediatorKind.Automatic) {
        this.sendLLMMediatorMessage(mediator, canSend);
      }
    })
  }

  /** Send LLM-generated mediator message. */
  async sendLLMMediatorMessage(
    mediator: MediatorConfig,
    sendCondition: () => boolean = () => { return true; }
  ) {
    const profiles = this.sp.experimentService.getParticipantProfiles();
    const prompt = createChatMediatorPrompt(
      mediator.prompt,
      this.messages,
      profiles,
    );

    await this.sp.llmService.call(prompt).then(modelResponse => {
      let answer = modelResponse.text;
      let sendMessage = false;
      try {
        const parsedResponse = JSON.parse(modelResponse.text);
        if ("shouldRespond" in parsedResponse && "response" in parsedResponse) {
          sendMessage = true;
          answer = parsedResponse.response;
        }
      } catch (error) {
        console.log("Invalid JSON: " + modelResponse);
        sendMessage = false;
      }

      if (sendMessage) {
        this.sendMediatorMessage(answer, mediator.name, mediator.avatar);
      }
    });
  }

  /** Send a message as a mediator.
   * @rights Experimenter
   */
  async sendMediatorMessage(text: string, name = "LLM Mediator", avatar = "🤖") {
    return createMessageCallable(
      this.sp.firebaseService.functions,
      {
      chatId: this.chatId!,
      experimentId: this.experimentId!,
      message: {
        kind: MessageKind.MediatorMessage,
        text,
        name,
        avatar
      },
    });
  }

}
