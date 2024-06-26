/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an Apache2 license that can be
 * found in the LICENSE file and http://www.apache.org/licenses/LICENSE-2.0
==============================================================================*/

import { Component, Inject, Signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';

import { StageKind, Vote, VoteForLeaderStageAnswer } from '@llm-mediation-experiments/utils';
import { CastViewingStage, ParticipantService } from 'src/app/services/participant.service';
import { forbiddenValueValidator } from 'src/lib/utils/angular.utils';

@Component({
  selector: 'app-exp-leader-vote',
  templateUrl: './exp-leader-vote.component.html',
  styleUrl: './exp-leader-vote.component.scss',
  standalone: true,
  imports: [MatRadioModule, MatButtonModule, FormsModule, ReactiveFormsModule],
})
export class ExpLeaderVoteComponent {
  readonly Vote = Vote;
  public votesForm: FormGroup;

  constructor(
    @Inject('stage') public stage: CastViewingStage<StageKind.VoteForLeader>,
    @Inject('hidden') public hidden: Signal<boolean>,
    public participantService: ParticipantService,
    fb: FormBuilder,
  ) {
    this.votesForm = fb.group({
      votes: fb.group({}),
    });

    this.initializeForm(stage.answers() ?? { votes: {}, kind: StageKind.VoteForLeader });
  }

  get votes() {
    return this.votesForm.get('votes') as FormGroup;
  }

  get controls() {
    return this.votes.controls as Record<string, FormControl>;
  }

  resetVote(userId: string) {
    this.votes.controls[userId].setValue(Vote.NotRated);
  }

  /** Clear the form in order to replace its contents */
  clearForm() {
    Object.keys(this.votes.controls).forEach((key) => {
      this.votes.removeControl(key);
    });
  }

  async nextStep() {
    await this.participantService
      .participant()
      ?.updateVoteForLeaderStage(this.stage.config().name, this.votesForm.value.votes);
    await this.participantService.workOnNextStage();
  }

  /** Call this when the input or the other participants signal change in order to stay up to date */
  initializeForm(answers: VoteForLeaderStageAnswer) {
    this.clearForm();
    for (const p of this.participantService.otherParticipants()) {
      this.votes.addControl(
        p.publicId,
        new FormControl(
          answers.votes[p.publicId] || Vote.NotRated,
          forbiddenValueValidator(Vote.NotRated),
        ),
      );
    }
  }
}
