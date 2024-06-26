import "../../pair-components/button";

import { observable } from "mobx";
import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { core } from "../../core/core";
import { ExperimentService } from "../../services/experiment_service";
import { ParticipantService } from "../../services/participant_service";
import { Pages, RouterService } from "../../services/router_service";

import { styles } from "./footer.scss";

/** Experiment stage footer */
@customElement("stage-footer")
export class Footer extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly experimentService = core.getService(ExperimentService);
  private readonly participantService = core.getService(ParticipantService);
  private readonly routerService = core.getService(RouterService);

  @property() disabled = false;

  override render() {
    return html`
      <div class="footer">
        <div class="left">
          <slot></slot>
        </div>
        <div class="right">
          ${this.renderNextStageButton()}
        </div>
      </div>
    `;
  }

  private renderNextStageButton() {
    const index = this.experimentService.getStageIndex(
      this.participantService.profile?.workingOnStageName ?? ""
    );

    const isLastStage = index === this.experimentService.stageNames.length - 1;

    const handleNext = () => {
      const nextStageName = this.experimentService.getNextStageName(
        this.participantService.profile?.workingOnStageName ?? ""
      );

      if (nextStageName !== null) {
        this.participantService.updateWorkingOnStageName(nextStageName);
        this.routerService.navigate(
          Pages.PARTICIPANT_STAGE,
          {
            "experiment": this.participantService.experimentId!,
            "participant": this.participantService.participantId!,
            "stage": nextStageName,
          }
        );
      } else {
        // TODO: navigate to an end-of-experiment payout page
        this.participantService.markExperimentCompleted();
        alert("Experiment completed!");

      }
    };

    const preventNextClick = this.disabled ||
      !this.participantService.isCurrentStage();

    return html`
      <pr-button
        variant=${this.disabled ? "default" : "tonal"}
        ?disabled=${preventNextClick}
        @click=${handleNext}
      >
        ${isLastStage ? "End experiment" : "Next stage"} 
      </pr-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "stage-footer": Footer;
  }
}
