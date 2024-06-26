import { isEqual } from 'lodash';

import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Signal, WritableSignal, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router } from '@angular/router';
import {
  ExperimentTemplate,
  InfoStageConfig,
  QuestionConfig,
  StageConfig,
  StageKind,
  SurveyQuestionKind,
  SurveyStageConfig,
  TermsOfServiceStageConfig,
  getDefaultChatAboutItemsConfig,
  getDefaultInfoConfig,
  getDefaultItemRatingsQuestion,
  getDefaultLeaderRevealConfig,
  getDefaultScaleQuestion,
  getDefaultSurveyConfig,
  getDefaultTosConfig,
  getDefaultUserProfileConfig,
  getDefaultVotesConfig,
  tryCast,
} from '@llm-mediation-experiments/utils';
import { AppStateService } from 'src/app/services/app-state.service';
import { LocalService } from 'src/app/services/local.service';
import { ExperimenterRepository } from 'src/lib/repositories/experimenter.repository';

const LOCAL_STORAGE_KEY = 'ongoing-experiment-creation';

const getInitStageData = (): Partial<StageConfig> => {
  return { name: '' };
};

@Component({
  selector: 'app-create-experiment',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
  ],
  templateUrl: './create-experiment.component.html',
  styleUrl: './create-experiment.component.scss',
})
export class CreateExperimentComponent {
  public existingStages: Partial<StageConfig>[] = [];
  public currentEditingStageIndex = -1;
  public newExperimentName = '';
  public numberOfParticipants = 3;
  public currentTemplateChoice: WritableSignal<ExperimentTemplate | undefined> = signal(undefined); // Dropdown choice
  public currentFullTemplate = computed(() => {
    // Template with its full config
    const choice = this.currentTemplateChoice();
    if (!choice) return undefined;

    return this.appState.experimenter.get().templatesWithConfigs.get(choice.id)();
  });

  // Make these fields available in the template
  readonly StageKind = StageKind;
  readonly SurveyQuestionKind = SurveyQuestionKind;
  readonly tryCast = tryCast;
  readonly availableStageKind = [
    StageKind.Info,
    StageKind.TermsOfService,
    StageKind.SetProfile,
    StageKind.TakeSurvey,
    StageKind.VoteForLeader,
    StageKind.GroupChat,
    StageKind.RevealVoted,
  ];

  // Convenience signals
  public templates: Signal<ExperimentTemplate[]>;

  private experimenter: ExperimenterRepository;

  constructor(
    private router: Router,
    private localStore: LocalService,
    private appState: AppStateService,
  ) {
    this.templates = appState.experimenter.get().templates;
    this.experimenter = appState.experimenter.get();

    // Set the current experiment template to the first fetched template
    effect(
      () => {
        const data = this.templates();

        if (data && this.existingStages.length === 0) {
          // Set the current stages to this template's stages
          this.currentTemplateChoice.set(data[0]);
        }
      },
      { allowSignalWrites: true },
    );

    // When the chosen full template changes, update the stages
    effect(() => {
      const fullTemplate = this.currentFullTemplate();
      if (!fullTemplate) return;

      this.existingStages = Object.values(fullTemplate.stageMap);
      this.persistExistingStages();
    });

    const existingStages = this.localStore.getData(LOCAL_STORAGE_KEY) as StageConfig[];
    if (existingStages) {
      this.existingStages = existingStages;
    }

    this.currentEditingStageIndex = 0;
  }

  /** Callback for template selection change */
  selectTemplate({ value }: MatSelectChange) {
    this.currentTemplateChoice.set(value);
  }

  get currentEditingStage(): StageConfig | undefined {
    const stage = this.existingStages[this.currentEditingStageIndex];

    return stage as StageConfig | undefined;
  }

  set currentEditingStage(stage: Partial<StageConfig>) {
    this.existingStages[this.currentEditingStageIndex] = stage;
  }

  get hasUnsavedData() {
    const existingStages = this.localStore.getData(LOCAL_STORAGE_KEY) as StageConfig[];
    return !isEqual(existingStages, this.existingStages);
  }

  // Add content
  addNewInfoLine(stage: InfoStageConfig) {
    stage.infoLines.push('');
    this.persistExistingStages();
  }

  deleteInfoLine(stage: InfoStageConfig, index: number) {
    stage.infoLines.splice(index, 1);
    this.persistExistingStages();
  }

  dropInfoLine(stage: InfoStageConfig, event: CdkDragDrop<string[]>) {
    moveItemInArray(stage.infoLines, event.previousIndex, event.currentIndex);

    this.persistExistingStages();
  }

  // tos lines
  addNewTosLine(stage: TermsOfServiceStageConfig) {
    stage.tosLines.push('');
    this.persistExistingStages();
  }

  deleteTosLine(stage: TermsOfServiceStageConfig, index: number) {
    stage.tosLines.splice(index, 1);
    this.persistExistingStages();
  }

  dropTosLine(stage: TermsOfServiceStageConfig, event: CdkDragDrop<string[]>) {
    moveItemInArray(stage.tosLines, event.previousIndex, event.currentIndex);

    this.persistExistingStages();
  }

  // survey questions
  addNewSurveyQuestion(event: Event, type: 'rating' | 'scale') {
    let question: QuestionConfig | null = null;
    if (type === 'rating') {
      question = getDefaultItemRatingsQuestion();
    } else if (type === 'scale') {
      question = getDefaultScaleQuestion();
    }
    (this.currentEditingStage as SurveyStageConfig).questions.push(question as QuestionConfig);
    this.persistExistingStages();
  }

  deleteSurveyQuestion(event: Event, index: number) {
    (this.currentEditingStage as SurveyStageConfig).questions.splice(index, 1);
    this.persistExistingStages();
  }

  moveSurveyQuestion(direction: 'up' | 'down', questionIndex: number) {
    if (questionIndex === 0 && direction === 'up') return;
    if (
      questionIndex === (this.currentEditingStage as SurveyStageConfig)?.questions.length - 1 &&
      direction === 'down'
    )
      return;

    moveItemInArray(
      (this.currentEditingStage as SurveyStageConfig).questions,
      questionIndex,
      direction === 'up' ? questionIndex - 1 : questionIndex + 1,
    );
  }

  dropSurveyQuestion(event: CdkDragDrop<string[]>) {
    moveItemInArray(
      (this.currentEditingStage as SurveyStageConfig).questions,
      event.previousIndex,
      event.currentIndex,
    );

    this.persistExistingStages();
  }

  stageSetupIncomplete(stageData?: Partial<StageConfig>) {
    const _stageData = stageData || this.currentEditingStage;
    if (!_stageData) return true;

    if (!_stageData.kind) return true;
    if (!_stageData.name || _stageData.name.trim().length === 0) return true;

    if (_stageData.kind === StageKind.TermsOfService || _stageData.kind === StageKind.SetProfile) {
      return false;
      // if (_stageData.config?.tosLines.length === 0) return true;
    } else if (_stageData.kind === StageKind.TakeSurvey) {
      if (_stageData?.questions?.length === 0) return true;
    }

    return false;
  }

  experimentSetupIncomplete() {
    if (this.newExperimentName.trim().length === 0) {
      return true;
    }
    return this.existingStages.some((stage) => this.stageSetupIncomplete(stage));
  }

  persistExistingStages() {
    this.localStore.saveData(LOCAL_STORAGE_KEY, this.existingStages);
  }

  dropStage(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.existingStages, event.previousIndex, event.currentIndex);
    this.persistExistingStages();

    this.navigateToStage(event.currentIndex);
  }

  addNewStage() {
    this.existingStages.push(getInitStageData());
    this.persistExistingStages();

    this.currentEditingStageIndex = this.existingStages.length - 1;
  }

  deleteStage(event: Event, index: number) {
    event.stopPropagation();

    if (this.existingStages.length === 1) {
      // only one left
      this.existingStages[0] = getInitStageData();
    } else {
      if (this.currentEditingStageIndex >= index) {
        this.currentEditingStageIndex -= 1;
      }
      this.existingStages.splice(index, 1);
    }

    this.persistExistingStages();
  }

  resetExistingStages() {
    this.localStore.removeData(LOCAL_STORAGE_KEY);
    const currentTemplate = this.currentFullTemplate();

    if (currentTemplate) {
      this.existingStages = Object.values(currentTemplate.stageMap);
    } else {
      // We assume that the user cannot click on reset when the page has not fully loaded
      this.existingStages = [];
    }

    this.persistExistingStages();

    this.currentEditingStageIndex = 0;
  }

  navigateToStage(idx: number) {
    this.currentEditingStageIndex = idx;
  }

  onChange(event: unknown, type?: string) {
    if (!this.currentEditingStage) return;

    if (type === 'stage-kind') {
      console.log('Switched to:', this.currentEditingStage.kind);
      let newConfig = {};
      switch (this.currentEditingStage.kind) {
        case StageKind.Info:
          newConfig = getDefaultInfoConfig();
          break;
        case StageKind.TermsOfService:
          newConfig = getDefaultTosConfig();
          break;
        case StageKind.SetProfile:
          newConfig = getDefaultUserProfileConfig();
          break;
        case StageKind.TakeSurvey:
          newConfig = getDefaultSurveyConfig();
          break;
        case StageKind.VoteForLeader:
          newConfig = getDefaultVotesConfig();
          break;
        case StageKind.GroupChat:
          newConfig = getDefaultChatAboutItemsConfig();
          break;
        case StageKind.RevealVoted:
          newConfig = getDefaultLeaderRevealConfig();
          break;
      }
      this.currentEditingStage = newConfig;
    }

    this.persistExistingStages();
  }

  compareTemplates(a: ExperimentTemplate, b: ExperimentTemplate) {
    return a.id === b.id;
  }

  /** Create the experiment and send it to be stored in the database */
  async addExperiment() {
    const stages = this.existingStages as StageConfig[];
    const { id } = await this.experimenter.createExperiment(
      this.newExperimentName,
      stages,
      this.numberOfParticipants,
    );

    // Navigate to the experiment page after creation
    localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear local storage
    this.router.navigate(['/experimenter', 'experiment', id]);
  }

  async addTemplate() {
    const stages = this.existingStages as StageConfig[];

    await this.experimenter.createTemplate(this.newExperimentName, stages);
    this.resetExistingStages();
  }
}
