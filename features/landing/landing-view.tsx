import type { ReactNode } from "react";
import ThemeToggle from "@/app/components/theme-toggle";
import { BrandMark } from "@/app/common/ui/primitives/brand-mark";
import { CharacterPortrait } from "@/app/common/ui/primitives/character-portrait";
import { ChevronDownIcon, DeckIcon, FlagIcon, LibraryIcon, LineageIcon, TrophyIcon } from "@/app/common/ui/primitives/icons";
import CardTypeIcon from "@/app/common/ui/cards/card-type-icon";
import { LandingImage } from "./components/landing-image";
import { SkillZoneDemo } from "./components/skill-zone-demo";
import type { LandingCharacter, LandingData } from "./types";
import styles from "./landing.module.css";

function ToolLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <a href={href} className={primary ? styles.primaryLink : styles.textLink}>{children}<ChevronDownIcon className={styles.arrow} /></a>;
}

function PedigreeNode({ character, trainee = false }: { character: LandingCharacter | undefined; trainee?: boolean }) {
  if (!character) return <div className={styles.pedigreeNode}><LineageIcon className={styles.missingPortrait} /><span>Choose an Uma</span></div>;
  return (
    <div className={`${styles.pedigreeNode} ${trainee ? styles.traineeNode : ""}`}>
      <CharacterPortrait src={character.portraitUrl} className={styles.portrait} />
      <span className={styles.pedigreeName}>{character.nameEn}</span>
      <span lang="ja" className={`${styles.pedigreeJapanese} text-zinc-400 dark:text-zinc-500`}>{character.nameJp}</span>
    </div>
  );
}

function PedigreePreview({ characters }: { characters: LandingCharacter[] }) {
  const character = (id: number) => characters.find((entry) => entry.id === id);
  return (
    <figure className={styles.pedigree} aria-label="Example pedigree: Almond Eye as trainee, Kitasan Black and Special Week as parents, with four grandparents">
      <figcaption className={styles.pedigreeCaption}>An example pedigree</figcaption>
      <div className={styles.generationLabel}>Grandparents</div>
      <div className={styles.grandparents}>
        <div className={styles.ancestorPair}><PedigreeNode character={character(101301)} /><PedigreeNode character={character(100301)} /></div>
        <div className={styles.ancestorPair}><PedigreeNode character={character(101701)} /><PedigreeNode character={character(100401)} /></div>
      </div>
      <div className={styles.parents}>
        <PedigreeNode character={character(106801)} /><PedigreeNode character={character(100101)} />
      </div>
      <div className={styles.parentLabel}>Parents</div>
      <div className={styles.trainee}><PedigreeNode character={character(112901)} trainee /></div>
      <div className={styles.traineeLabel}>Trainee</div>
    </figure>
  );
}

export function LandingFeature({ data }: { data: LandingData }) {
  const heroCards = [data.cards[1], data.cards[0], data.cards[3]].filter((card) => card != null);
  return (
    <div id="top" className={styles.page}>
      <a href="#landing-content" className={styles.skipLink}>Skip to content</a>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <a href="/landing" className={styles.brand} aria-label="AlmondEye DB landing page"><BrandMark /><span>AlmondEye <span className={styles.brandSuffix}>DB</span></span></a>
          <nav aria-label="Landing navigation" className={styles.navigation}>
            <a href="#decks">Decks</a><a href="#parenting">Parenting</a><a href="#visualizer">Visualizer</a>
          </nav>
          <div className={styles.headerActions}>
            <div className={styles.themeToggle}><ThemeToggle /></div>
            <ToolLink href="/#main" primary>Open app</ToolLink>
          </div>
        </div>
      </header>

      <main id="landing-content" tabIndex={-1} className={styles.container}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><FlagIcon className={styles.eyebrowIcon} />Uma Musume: Pretty Derby</p>
            <h1 id="landing-title" className={styles.heroTitle}><span>Build your deck.</span><span>Know your race.</span></h1>
            <p className={styles.heroDescription}>Plan support decks, trace inheritance, and see where your skills can activate.</p>
            <div className={styles.heroActions}><ToolLink href="/#main" primary>Build a deck</ToolLink><ToolLink href="#visualizer">Try the visualizer</ToolLink></div>
          </div>
          <div className={styles.heroVisual} aria-label="Almond Eye, Kitasan Black and Fine Motion support card artwork">
            {heroCards.map((card, index) => (
              <figure key={card.id} className={`${styles.heroCard} ${[styles.heroCardLeft, styles.heroCardCenter, styles.heroCardRight][index]}`}>
                <LandingImage src={card.imgUrl} alt={`${card.nameEn} support card`} width={384} height={512} priority={index === 1} className={styles.heroCardImage} />
              </figure>
            ))}
            {!heroCards.length && <BrandMark className={styles.heroFallback} />}
          </div>
        </section>

        <section id="decks" className={styles.deckSection} aria-labelledby="deck-title">
          <div className={styles.sectionHeading}>
            <h2 id="deck-title">Six cards.<br />A clearer plan.</h2>
            <p>Build your main deck. Find the right support for your parent deck.</p>
          </div>
          <div className={styles.deckGrid} aria-label="Example six-card support deck">
            {data.cards.map((card) => (
              <figure key={card.id} className={styles.deckCard}>
                <LandingImage src={card.imgUrl} alt={`${card.nameEn} support card artwork`} width={256} height={342} className={styles.deckCardImage} />
                <figcaption>
                  <div className={styles.cardNameRow}><span className={styles.cardName}>{card.nameEn}</span><CardTypeIcon type={card.type} size={20} className={styles.cardTypeIcon} /></div>
                  <p lang="ja" title={card.nameJp} className={`${styles.cardJapanese} text-zinc-400 dark:text-zinc-500`}>{card.nameJp}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className={styles.sampleCaption}>A sample support deck. Make it yours in the builder.</p>
          <div className={styles.deckTools}>
            <div className={styles.toolDescription}>
              <DeckIcon className={styles.toolIcon} />
              <div><h3>Main Deck</h3><p>Bring your support skills together. See what each card adds, and where your deck overlaps.</p><ToolLink href="/#main">Build your deck</ToolLink></div>
            </div>
            <div className={styles.toolDescription}>
              <LineageIcon className={styles.toolIcon} />
              <div><h3>Parent Deck</h3><p>Find support cards for the skills you want to inherit. Give your next training run a purpose.</p><ToolLink href="/#parent-deck">Plan a parent deck</ToolLink></div>
            </div>
          </div>
        </section>

        <section id="parenting" className={styles.parentingSection} aria-labelledby="parenting-title">
          <div className={styles.parentingCopy}>
            <h2 id="parenting-title">Good inheritance<br />starts with a plan.</h2>
            <p>Bring parents, grandparents, and support skills into one view. Explore the connections before committing to your next run.</p>
            <ToolLink href="/#parenting">Plan your pedigree</ToolLink>
          </div>
          <PedigreePreview characters={data.characters} />
        </section>

        <section id="visualizer" className={styles.visualizerSection} aria-labelledby="visualizer-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}><FlagIcon className={styles.eyebrowIcon} />Try it on the track</p>
            <h2 id="visualizer-title">See where your skills<br />can activate.</h2>
            <p>Pick a skill. Follow its activation zones across Tokyo's 2000m turf course.</p>
          </div>
          <SkillZoneDemo data={data.demo} />
        </section>

        <section id="library" className={styles.librarySection} aria-labelledby="library-title">
          <div className={styles.libraryIntro}>
            <h2 id="library-title">Your collection.<br />Your next build.</h2>
            <p>Keep your support cards and trained Umas close to your plans.</p>
          </div>
          <div className={styles.libraryTools}>
            <a href="/supports" className={styles.libraryLink}><LibraryIcon className={styles.libraryIcon} /><span><strong>Supports</strong><span>Track the support cards you own.</span></span><ChevronDownIcon className={styles.arrow} /></a>
            <a href="/characters" className={styles.libraryLink}><LibraryIcon className={styles.libraryIcon} /><span><strong>Characters</strong><span>Browse every playable costume.</span></span><ChevronDownIcon className={styles.arrow} /></a>
            <a href="/#veterans" className={styles.libraryLink}><TrophyIcon className={styles.libraryIcon} /><span><strong>Trained Umas</strong><span>Keep your trained runners in view.</span></span><ChevronDownIcon className={styles.arrow} /></a>
          </div>
          <div className={styles.finalCta}><h3>Make your next deck count.</h3><ToolLink href="/#main" primary>Open AlmondEye DB</ToolLink></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerTop}><a href="/landing" className={styles.brand}><BrandMark /><span>AlmondEye <span className={styles.brandSuffix}>DB</span></span></a><ToolLink href="#top">Back to top</ToolLink></div>
          <div className={styles.footerBottom}><p>An unofficial, non-commercial Uma Musume fan tool.<br />Uma Musume: Pretty Derby and related media belong to Cygames, Inc.</p><span>© {new Date().getFullYear()} AlmondEye DB</span></div>
        </div>
      </footer>
    </div>
  );
}
