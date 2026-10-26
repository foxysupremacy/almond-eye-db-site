"use client";

// The Parenting Hub for AlmondEye DB — rebuilt around branch compatibility:
// - Target Trainee stage + live lineage affinity header (◎ / ◯ / △)
// - Two parent slots with auto-resolved grandparent chips (from succession history)
// - GameTora-style compatibility lists: best legacies + per-branch sub-legacies,
//   ranked by affinity and filtered by unique-skill track/style suitability.

import CharacterPickerModal from "@/features/parenting/components/character-picker-modal";
import { VeteranPickerModal } from "@/features/veterans";
import InheritedSkillsModal from "@/features/parenting/components/inherited-skills-modal";
import { LineageAffinityHeader } from "@/features/parenting/components/lineage-affinity-header";
import { TraineeSpotlight } from "@/features/parenting/components/trainee-spotlight";
import { PedigreeSkillsSection } from "@/features/parenting/components/pedigree-skills-section";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { CheckIcon, DeckIcon, LinkIcon } from "@/app/common/ui/primitives/icons";
import { ParentingLoopOptimizer } from "./loop-optimizer";
import { useParentingViewModel } from "./view-models/use-parenting-view-model";

export interface ParentingViewProps {
  onNavigateToParentDeck?: () => void;
}

export default function ParentingView({ onNavigateToParentDeck }: ParentingViewProps) {
  const { state, commands } = useParentingViewModel({ onNavigateToParentDeck });

  const {
    loading,
    veterans,
    characters,
    targetChara,
    setup,
    affinityBreakdown,
    statBonuses,
    participantsList,
    isCompactPage,
    isTraineeModalOpen,
    activePickerSlot,
    pickerRecommendations,
    pickerRecommendationsLoading,
    pickerRecommendationsError,
    isInheritedSkillsOpen,
    copiedLink,
    pageRef,
    course,
    runningStyle,
    pickerContextParent,
    activeSlotLabel,
    excludedCharId,
  } = state;

  // The <section> below is the same element across loading -> loaded so pageRef stays observed.
  const parentDeckBanner = (
    <div
      className={
        isCompactPage
          ? "flex items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800"
          : "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800"
      }
    >
      <div className="flex items-center gap-3">
        <DeckIcon className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Ready to build your support cards & farm skills?
          </h4>
          {!isCompactPage && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Go to the Parent Deck tab to select 6 support cards and inspect all inheritable skills.
            </p>
          )}
        </div>
      </div>
      {onNavigateToParentDeck && (
        <AppButton
          variant="quiet"
          onPress={onNavigateToParentDeck}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm active:scale-95 cursor-pointer transition-all duration-150 ease-out-quart shrink-0"
        >
          Go to Parent Deck
        </AppButton>
      )}
    </div>
  );

  return (
    <section ref={pageRef} className="relative w-full flex flex-col gap-6">
      {!loading && (
        <>
          {/* Unified 14-ancestor pedigree and loop planner */}
          <ParentingLoopOptimizer
            target={targetChara}
            course={course}
            runningStyle={runningStyle}
            actions={
              <>
                <AppButton
                  variant="quiet"
                  onPress={commands.handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer transition-colors"
                  title="Copy shareable link with current setup"
                >
                  {copiedLink ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                  <span>{copiedLink ? "Link Copied!" : "Share Plan"}</span>
                </AppButton>
                <AppButton
                  variant="quiet"
                  onPress={commands.resetParenting}
                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer transition-colors"
                >
                  Reset Setup
                </AppButton>
              </>
            }
            targetStage={
              <div>
                <LineageAffinityHeader
                  affinityBreakdown={affinityBreakdown}
                  onOpenInheritedSkills={commands.openInheritedSkills}
                />
                <TraineeSpotlight
                  compact={isCompactPage}
                  targetChara={targetChara}
                  statBonuses={statBonuses}
                  onSelectTrainee={commands.openTraineeModal}
                />
              </div>
            }
            veterans={veterans}
            roster={characters}
            setup={setup}
            onOpenPicker={commands.openPicker}
            updateSetup={commands.updateSetup}
          />

          {/* 3. NAVIGATION BANNER TO PARENT DECK (desktop: before the skills section) */}
          {!isCompactPage && parentDeckBanner}

          {/* 4. PEDIGREE INHERITABLE SKILLS (Innate, Awakening, Events, Uniques, Factors) */}
          <PedigreeSkillsSection />

          {/* Phone/tablet: the banner moves after the skills section as a single row */}
          {isCompactPage && parentDeckBanner}

          {/* Trainee Character Picker Modal */}
          <CharacterPickerModal
            isOpen={isTraineeModalOpen}
            onClose={commands.closeTraineeModal}
            characters={characters}
            onSelect={commands.selectTrainee}
            title="Select Target Trainee"
          />

          {/* Veteran / Template Picker Modal */}
          <VeteranPickerModal
            isOpen={activePickerSlot !== null}
            minmaxEnabled
            onClose={commands.closePicker}
            slotLabel={activeSlotLabel}
            recommendations={pickerRecommendations ?? undefined}
            recommendationsLoading={pickerRecommendationsLoading}
            recommendationsError={pickerRecommendationsError}
            onSelectCandidate={commands.selectCandidate}
            targetCharaId={setup.targetCharaId}
            excludedCharId={excludedCharId}
            veterans={veterans}
            characters={characters}
            contextParent={pickerContextParent}
            onSelectVeteran={commands.selectVeteran}
            onSelectCharacterTemplate={commands.selectTemplate}
          />

      {/* Inherited Skills & Factors Modal */}
          <InheritedSkillsModal
            isOpen={isInheritedSkillsOpen}
            onClose={commands.closeInheritedSkills}
            participants={participantsList}
          />
        </>
      )}
      <LoadingAnimation
        active={loading}
        label="Loading Parenting Hub & Inheritance Engine..."
        className="py-16"
      />
    </section>
  );
}
