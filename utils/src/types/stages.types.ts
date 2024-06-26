/** Stages types & default definitions */

import { ChatConfig, PublicChatData } from './chats.types';
import { MediatorConfig } from './mediator.types';
import { QuestionAnswer, QuestionConfig } from './questions.types';
import { Votes } from './votes.types';

export enum StageKind {
  Info = 'info',
  TermsOfService = 'termsOfService',
  SetProfile = 'setProfile',
  GroupChat = 'groupChat',
  VoteForLeader = 'voteForLeader',
  RevealVoted = 'leaderReveal',
  TakeSurvey = 'takeSurvey',
  // RankItems = 'rankItems',
}

// ********************************************************************************************* //
//                                           CONFIGS                                             //
// ********************************************************************************************* //

/** Some stages require all participants to finish before allowing anyone to go on to the next stage */
export const ALLOWED_STAGE_PROGRESSION = {
  [StageKind.Info]: false,
  [StageKind.TermsOfService]: false,
  [StageKind.SetProfile]: false,
  [StageKind.GroupChat]: false,
  [StageKind.VoteForLeader]: true,
  [StageKind.RevealVoted]: false,
  [StageKind.TakeSurvey]: true,
  // [StageKind.RankItems]: false,
} as const;

interface BaseStageConfig {
  kind: StageKind;
  name: string;
  description?: string;
}

export interface InfoStageConfig extends BaseStageConfig {
  kind: StageKind.Info;
  infoLines: string[];
}

export interface TermsOfServiceStageConfig extends BaseStageConfig {
  kind: StageKind.TermsOfService;
  tosLines: string[];
}

export interface ProfileStageConfig extends BaseStageConfig {
  kind: StageKind.SetProfile;
}

export interface SurveyStageConfig extends BaseStageConfig {
  kind: StageKind.TakeSurvey;
  questions: QuestionConfig[];
}

export interface GroupChatStageConfig extends BaseStageConfig {
  kind: StageKind.GroupChat;
  chatId: string;
  chatConfig: ChatConfig;
  mediators: MediatorConfig[];
}

export interface VoteForLeaderStageConfig extends BaseStageConfig {
  kind: StageKind.VoteForLeader;
}

export interface RevealVotedStageConfig extends BaseStageConfig {
  kind: StageKind.RevealVoted;
  pendingVoteStageName: string; // Name of the `VoteForLeader` stage that this stage is revealing the results of
}

export type StageConfig =
  | InfoStageConfig
  | TermsOfServiceStageConfig
  | ProfileStageConfig
  | SurveyStageConfig
  | GroupChatStageConfig
  | VoteForLeaderStageConfig
  | RevealVotedStageConfig;

// ********************************************************************************************* //
//                                           ANSWERS                                             //
// ********************************************************************************************* //

interface BaseStageAnswer {
  kind: StageKind;
}

export interface SurveyStageAnswer extends BaseStageAnswer {
  kind: StageKind.TakeSurvey;

  // For convenience, we store answers in a `question id` -> `answer` record
  answers: Record<number, QuestionAnswer>;
}

export interface VoteForLeaderStageAnswer extends BaseStageAnswer {
  kind: StageKind.VoteForLeader;

  votes: Votes;
}

// NOTE: profile & TOS stages do not have "answers", as the results are stored directly in the participant profile.
// NOTE: answer documents are lazily created in firestore. They may not exist before the participant submits their answers for the first time.
export type StageAnswer = SurveyStageAnswer | VoteForLeaderStageAnswer;

// ********************************************************************************************* //
//                                        PUBLIC DATA                                            //
// ********************************************************************************************* //

interface BasePublicStageData {
  kind: StageKind;
}

export interface GroupChatStagePublicData extends BasePublicStageData {
  kind: StageKind.GroupChat;

  numberOfParticipants: number; // Repeat this here for convenience
  readyToEndChat: Record<string, boolean>; // Participant public id => ready to end chat
  chatData: PublicChatData;
}

export interface VoteForLeaderStagePublicData extends BasePublicStageData {
  kind: StageKind.VoteForLeader;

  participantvotes: Record<string, Votes>; // Participant public id => votes of this participant
  currentLeader: string | null; // Updated automatically after each vote
}

// NOTE: some stages do not have public stage data
export type PublicStageData = GroupChatStagePublicData | VoteForLeaderStagePublicData;

// ********************************************************************************************* //
//                                         DEFAULTS                                              //
// ********************************************************************************************* //

export const getDefaultInfoConfig = (): InfoStageConfig => {
  return {
    kind: StageKind.Info,
    name: 'Information',
    infoLines: [],
  };
};

export const getDefaultTosConfig = (): TermsOfServiceStageConfig => {
  return {
    kind: StageKind.TermsOfService,
    name: 'Accept TOS',
    tosLines: [],
  };
};

export const getDefaultUserProfileConfig = (): ProfileStageConfig => {
  return {
    kind: StageKind.SetProfile,
    name: 'Set profile',
  };
};

export const getDefaultSurveyConfig = (): SurveyStageConfig => {
  return {
    kind: StageKind.TakeSurvey,
    name: 'Take survey',
    questions: [],
  };
};

export const getDefaultLeaderRevealConfig = (): RevealVotedStageConfig => {
  return {
    kind: StageKind.RevealVoted,
    name: 'Reveal voted leader',
    pendingVoteStageName: '',
  };
};
