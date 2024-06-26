import "../../pair-components/button";
import "../../pair-components/icon_button";
import "../../pair-components/menu";
import "../../pair-components/textarea";
import "../../pair-components/tooltip";

import "../info/info_config";
import "../survey/survey_config";
import "../tos/tos_config";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";

import { core } from "../../core/core";
import {
  ExperimentConfigService
} from "../../services/config/experiment_config_service";


import { StageKind } from "@llm-mediation-experiments/utils";
import {
  MODULE_DESCRIPTION_LAS,
  MODULE_DESCRIPTION_LEADER,
} from "../../shared/constants";
import {
  createChatStage,
  createInfoStage,
  createLostAtSeaModuleStages,
  createProfileStage,
  createRevealVotedStage,
  createSurveyStage,
  createVoteForLeaderStage,
  isLostAtSeaModuleStage,
} from "../../shared/utils";

import { styles } from "./experiment_config_menu.scss";

/** Experiment config dropdown menu for adding stages. */
@customElement("experiment-config-menu")
export class ExperimentConfigMenu extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentConfig = core.getService(ExperimentConfigService);

  override render() {
    const onAddInfoClick = () => {
      this.experimentConfig.addStage(createInfoStage());
      this.experimentConfig.setCurrentStageIndexToLast();
    }

    const onAddSurveyClick = () => {
      this.experimentConfig.addStage(createSurveyStage());
      this.experimentConfig.setCurrentStageIndexToLast();
    }

    const onAddProfileClick = () => {
      this.experimentConfig.addStage(createProfileStage());
      this.experimentConfig.setCurrentStageIndexToLast();
    }

    const onAddChatClick = () => {
      this.experimentConfig.addStage(createChatStage("Simple chat"));
      this.experimentConfig.setCurrentStageIndexToLast();
    }

    return html`
      <pr-menu name="Add stage">
        <div class="menu-wrapper">
          <div class="stages">
            <div class="category">Stages</div>
            <div class="menu-item" role="button" @click=${onAddInfoClick}>
              Info stage
            </div>
            <div class="menu-item" role="button" @click=${onAddSurveyClick}>
              Survey stage
            </div>
            <div class="menu-item" role="button" @click=${onAddProfileClick}>
              Profile stage
            </div>
            <div class="menu-item" role="button" @click=${onAddChatClick}>
              Simple chat stage
            </div>
          </div>
          <div class="modules">
            <div class="category tertiary">Modules</div>
              ${this.renderLeaderModule()}
              ${this.renderLostAtSeaModule()}
            </div>
        </div>
      </pr-menu>
    `;
  }

  private renderLeaderModule() {
    if (this.experimentConfig.hasStageKind(StageKind.VoteForLeader)) {
      return nothing;
    }

    const onAddLeaderClick = () => {
      this.experimentConfig.addStage(createVoteForLeaderStage());
      this.experimentConfig.addStage(createRevealVotedStage());
      this.experimentConfig.setCurrentStageIndexToLast();
    }

    return html`
      <div class="menu-item" role="button" @click=${onAddLeaderClick}>
        <div class="module-title">🗳️ Participant election</div>
        <div class="module-info">${MODULE_DESCRIPTION_LEADER}</div>
      </div>
    `;
  }

  private renderLostAtSeaModule() {
    if (this.experimentConfig.stages.find(stage => isLostAtSeaModuleStage(stage))) {
      return nothing;
    }

    const onAddLostAtSeaClick = () => {
      const lostAtSeaStages = createLostAtSeaModuleStages();
      lostAtSeaStages.forEach(stage => {
        this.experimentConfig.addStage(stage);
      });

      this.experimentConfig.setCurrentStageIndexToLast();
    }

    return html`
      <div class="menu-item" role="button" @click=${onAddLostAtSeaClick}>
        <div class="module-title">🌊 Lost at Sea</div>
        <div class="module-info">${MODULE_DESCRIPTION_LAS}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "experiment-config-menu": ExperimentConfigMenu;
  }
}
