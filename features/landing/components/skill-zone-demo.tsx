"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import { CheckIcon, ChevronDownIcon } from "@/app/common/ui/primitives/icons";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { renderCourse } from "@/features/visualizer/rendering";
import { evaluateDemoSkill } from "../demo-model";
import type { LandingDemoData } from "../types";
import styles from "../landing.module.css";

const mobileQuery = "(max-width: 767px)";
function subscribeToLayout(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getMobileLayout = () => window.matchMedia(mobileQuery).matches;
const getServerLayout = () => false;

function DemoUnavailable() {
  return (
    <div className={styles.demoUnavailable} role="status">
      <p>The sample course is unavailable right now.</p>
      <a className={styles.textLink} href="/#visualizer">Open the full visualizer<ChevronDownIcon className={styles.arrow} /></a>
    </div>
  );
}

export function SkillZoneDemo({ data }: { data: LandingDemoData | null }) {
  if (!data || !data.skills.length) return <DemoUnavailable />;
  return <InteractiveDemo data={data} />;
}

function InteractiveDemo({ data }: { data: LandingDemoData }) {
  const isMobile = useSyncExternalStore(subscribeToLayout, getMobileLayout, getServerLayout);
  const [selectedId, setSelectedId] = useState(data.skills[0].id);
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">("loading");
  const hostRef = useRef<HTMLDivElement>(null);
  const summaryId = useId();
  const selected = data.skills.find((skill) => skill.id === selectedId) ?? data.skills[0];
  const result = useMemo(() => {
    try {
      return evaluateDemoSkill(data.course, selected);
    } catch {
      return null;
    }
  }, [data.course, selected]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!result) {
      host.replaceChildren();
      setRenderStatus("error");
      return;
    }
    try {
      const svg = renderCourse(host, data.course, { zones: result.zones, showSpeedLane: false });
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${selected.nameEn} activation zones on Tokyo Turf 2000m`);
      svg.setAttribute("aria-describedby", summaryId);
      setRenderStatus("ready");
    } catch {
      host.replaceChildren();
      setRenderStatus("error");
    }
    return () => host.replaceChildren();
  }, [data.course, result, selected.nameEn, summaryId]);

  return (
    <div className={styles.demo}>
      <div className={styles.demoTopline}>
        <div className={styles.courseIdentity}><strong>Tokyo</strong><span lang="ja" className="text-zinc-400 dark:text-zinc-500">東京</span></div>
        <div className={styles.courseMetadata}><span>Turf</span><span>2000m</span><span>Left-handed</span></div>
      </div>
      <ToggleButtonGroup
        aria-label="Choose a demo skill"
        orientation={isMobile ? "vertical" : "horizontal"}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[String(selected.id)]}
        onSelectionChange={(keys) => {
          const id = Number([...keys][0]);
          if (data.skills.some((skill) => skill.id === id)) setSelectedId(id);
        }}
        className={styles.skillChoices}
      >
        {data.skills.map((skill) => (
          <ToggleButton key={skill.id} id={String(skill.id)} aria-label={`Show ${skill.nameEn} activation zones`} className={styles.skillChoice}>
            <SkillIcon iconId={skill.iconId} name={skill.nameEn} size={32} className={styles.skillIcon} />
            <span className={styles.skillNames}>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{skill.nameEn}</span>
              <span lang="ja" className="mt-0.5 text-zinc-400 dark:text-zinc-500">{skill.nameJp}</span>
            </span>
            <CheckIcon className={styles.skillCheck} />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className={styles.timelineFrame} aria-busy={renderStatus === "loading"}>
        <div className={styles.timelineScroll} tabIndex={0} role="region" aria-label="Race timeline, scroll horizontally to explore the full course">
          <div ref={hostRef} className={styles.timeline} />
        </div>
        <LoadingAnimation
          active={renderStatus === "loading"}
          variant="overlay"
          size="md"
          label="Preparing the race timeline..."
        />
        {renderStatus === "error" && (
          <p className={styles.timelineMessage} role="status">
            This skill's timeline is unavailable. Try another skill or open the full visualizer.
          </p>
        )}
      </div>
      <div className={styles.demoExplanation}>
        <div>
          <p id={summaryId} className={styles.zoneSummary} role="status" aria-atomic="true">
            <strong>{selected.nameEn}</strong>
            <span>{result ? `Possible activation zones: ${result.rangeText}` : "Activation zones are unavailable for this skill."}</span>
          </p>
          {result && <p className={styles.conditionText}>{result.conditionText}</p>}
        </div>
        {result && <div className={styles.zoneLegend}>
          <span className={result.isRandom ? styles.randomLine : styles.solidLine} aria-hidden="true" />
          <span>{result.isRandom ? "Random trigger location" : "Deterministic trigger location"}</span>
        </div>}
      </div>
      <div className={styles.demoBottomline}>
        <p>These are candidate zones, not a guaranteed activation.</p>
        <a href="/#visualizer" className={styles.textLink}>Open the full visualizer<ChevronDownIcon className={styles.arrow} /></a>
      </div>
    </div>
  );
}
