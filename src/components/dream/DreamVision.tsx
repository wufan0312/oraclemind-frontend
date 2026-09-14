'use client';

import { useEffect, useRef, useState } from 'react';
import { hashStr } from '@/lib/hash';

interface DreamVisionProps {
  keyword: string;
  title?: string;
  streaming?: boolean;
  onDone?: () => void;
}

const KEYWORD_TO_PROMPT: Record<string, string> = {
  // === 人物/动物类 ===
  蛇: 'giant snake with glowing eyes in dark forest, mystical serpent, eerie green mist, dreamlike atmosphere, cinematic lighting, photorealistic',
  牙: 'extreme close up of human mouth showing teeth, individual teeth floating and glowing like crystals, surreal dream, dark purple cosmic background, ethereal purple glow, hyper detailed, cinematic lighting, photorealistic',
  掉牙: 'extreme close up of human mouth, teeth dramatically falling out and transforming into glowing stars, surreal horror dream, dark purple cosmic background, eerie ethereal glow, hyper detailed, cinematic lighting, photorealistic',
  狗: 'loyal dog with glowing eyes standing in moonlit forest, mystical canine companion, warm golden aura, dreamlike, cinematic',
  猫: 'mysterious black cat with glowing eyes in purple mist, supernatural feline, mystical aura, dreamlike, cinematic',
  鱼: 'glowing fish swimming through dark ocean, bioluminescent creatures, mystical underwater dreamscape, ethereal blue light, cinematic',
  鼠: 'small mouse creature with glowing tail in dark forest, mystical guide, warm earthy tones, dreamlike, cinematic',
  虎: 'majestic tiger with golden eyes standing in misty mountains, powerful spirit animal, mythical, dramatic lighting, cinematic',
  鬼: 'translucent ghost figure floating in dark room, eerie but gentle spirit, white glow, supernatural, dreamlike, cinematic',
  亲人: 'warm glowing figure of ancestor with outstretched hands, loving presence, golden light, emotional reunion, ethereal, cinematic',
  已故: 'translucent spirit of deceased loved one surrounded by golden light, peaceful reunion, emotional, ethereal atmosphere, cinematic',
  蝴蝶: 'beautiful butterfly with luminous wings in enchanted garden, magical transformation, vibrant colors, dewdrops, dreamlike, cinematic',

  // === 动作类 ===
  追: 'person running away from shadowy figure chasing them through dark forest, dramatic chase scene, moonlight, eerie atmosphere, cinematic',
  被追: 'person being chased by dark shadowy figure in dark forest, running in terror, moonlight, dramatic tension, eerie atmosphere, cinematic',
  被绑架: 'person being grabbed and pulled into darkness, dramatic struggle scene, eerie lighting, supernatural, cinematic',
  迷路: 'person standing at crossroads in misty forest, confused and lost, glowing paths diverging, ethereal atmosphere, cinematic',
  迟到: 'person running frantically toward glowing destination, time running out, urgent atmosphere, dramatic lighting, cinematic',
  坠落: 'person falling from sky toward earth, transforming into light, rebirth symbolism, clouds, dramatic, cinematic',
  飞: 'person flying through clouds with arms outstretched, soaring freely, golden sunrise, sense of freedom, dreamlike, cinematic',
  飞翔: 'person flying through starry sky, body glowing, spiritual ascension, cosmic background, ethereal, cinematic',
  跑: 'person running through beautiful landscape at sunset, full of energy, wind blowing hair, golden light, cinematic',
  走: 'person walking on ancient path through misty mountains, spiritual journey, glowing footsteps, ethereal, cinematic',
  哭: 'person crying with tears glowing like liquid light, emotional release, sad but beautiful, ethereal atmosphere, cinematic',
  笑: 'person laughing with joy, light particles bursting around them, pure happiness, golden glow, cinematic',
  找: 'person searching with glowing lantern in dark cave, quest for truth, dramatic shadows, mysterious, cinematic',

  // === 事件/场景类 ===
  结婚: 'wedding ceremony in magical garden, glowing floral arch, pink rose petals falling, dreamlike romance, ethereal, cinematic',
  发财: 'golden coins and treasure floating around person, wealth manifestation, magical prosperity, glowing aura, cinematic',
  钱: 'person surrounded by floating money and gold coins, financial abundance, magical prosperity, golden glow, cinematic',
  考试: 'student studying with glowing books and floating knowledge symbols, exam preparation, golden library, cinematic',
  怀孕: 'radiant pregnant woman in blooming garden, new life, maternal glow, flowers blooming, soft pink and gold, cinematic',
  打仗: 'ancient battle scene with glowing weapons clashing, warriors in combat, dramatic light and shadow, mythical, cinematic',
  刀: 'mystical glowing dagger floating in air, magical weapon, golden runes, dark background, cinematic',
  血: 'person with glowing wounds, blood transforming into golden particles, mystical healing, dramatic, cinematic',
  杀: 'shadowy figure striking, dramatic transformation from darkness to light, supernatural, cinematic',
  电梯: 'elevator floating upward through clouds and starry sky, magical transportation, glowing doors, cinematic',
  学校: 'school building with glowing windows, students with glowing books, magical education atmosphere, golden light, cinematic',
  工作: 'workplace with glowing screens, creative energy flowing, person working at desk, modern mystical scene, cinematic',
  电话: 'glowing vintage telephone ringing, message from unknown caller, mysterious atmosphere, dark background, cinematic',
  手机: 'smartphone with glowing screen showing mysterious message, digital communication, dark atmosphere, cinematic',

  // === 自然/元素类 ===
  水: 'calm water reflecting starry sky, misty waves, ethereal blue glow, dreamlike lake, cinematic',
  河: 'winding river flowing through misty valley, luminous water, ancient bridge, ethereal atmosphere, cinematic',
  海: 'vast ocean under starry sky, bioluminescent waves, mysterious depths, ethereal blue and silver, cinematic',
  雨: 'glowing raindrops falling like liquid light, mystical rain, neon reflections, cinematic',
  雪: 'luminous snowflakes falling softly, magical winter, frozen landscape, ethereal white and blue, cinematic',
  冰: 'crystalline ice structures glowing in dark, frozen beauty, cyan and white light, cinematic',
  火: 'dancing flames forming mystical shapes, magical fire, orange and gold glow, dark background, cinematic',
  雷: 'dramatic lightning striking, thunderstorm, raw power, golden and purple light, cinematic',
  电: 'electric energy arcing through air, mystical lightning, dramatic power, bright white and purple, cinematic',
  风: 'wind carrying leaves and light particles, invisible force made visible, ethereal motion, cinematic',
  云: 'soft luminous clouds drifting, dreamlike sky scene, pastel colors, ethereal, cinematic',
  日: 'majestic sun rising over mountains, new dawn, golden light, hopeful atmosphere, cinematic',
  月: 'full moon glowing brightly in starry night, celestial light, silver and purple glow, dreamlike, cinematic',
  星: 'shooting stars and constellations in night sky, cosmic wonder, multiple colors, ethereal, cinematic',
  山: 'majestic glowing mountain, spiritual elevation, golden peak, mystical atmosphere, cinematic',
  树: 'ancient glowing tree of life, deep roots reaching sky, emerald leaves, mystical, cinematic',
  花: 'enchanted glowing flowers in bloom, magical garden, vibrant colors, dewdrops, cinematic',
  路: 'winding glowing path through misty forest, mysterious journey, ethereal lights, cinematic',
  桥: 'luminous bridge spanning misty chasm, crossing between worlds, glowing rails, ethereal, cinematic',
  门: 'glowing portal door, mysterious entrance to another world, mystical threshold, cinematic',
  窗: 'window showing starry dreamscape beyond, cosmic view, ethereal glow, curtains, cinematic',
  房: 'floating dream house in clouds, windows glowing warm light, magical architecture, cinematic',

  // === 物品/服饰类 ===
  包: 'mysterious glowing bag, hidden treasure inside, mystical discovery, dark background, cinematic',
  衣服: 'flowing glowing robe being worn, magical transformation, ethereal fabric, golden threads, cinematic',
  鞋: 'glowing shoes with magical properties, leaving light footprints, journey begins, cinematic',
  车: 'flying car hovering above ground, liberation, golden light trails, futuristic, cinematic',
  飞机: 'airplane flying through starry clouds, cosmic travel, glowing engines, dreamlike, cinematic',

  // === 色彩/氛围类 ===
  黑: 'profound darkness with hidden shapes barely visible, mysterious void, single point of light, cinematic',
  白: 'pure radiant white light, spiritual purity, luminous glow, ethereal, cinematic',
  红: 'passionate red energy swirling, blood moon, life force, dramatic crimson glow, cinematic',
  黄: 'golden radiant energy, divine illumination, wisdom, abundance, golden light rays, cinematic',
  蓝: 'serene blue cosmic energy, spiritual depth, ocean of light, ethereal celestial, cinematic',
  绿: 'vibrant green life energy, growth and healing, forest glow, mystical nature, cinematic',
  紫: 'purple mystical energy, spiritual transformation, royal purple glow, ethereal, cinematic',
};

const FALLBACK_PROMPT = 'surreal dreamscape with swirling cosmic light and floating particles, mystical atmosphere, soft purple and gold tones, dreamy ethereal glow, cinematic lighting, photorealistic';

function buildPrompt(keyword: string): string {
  const text = keyword.toLowerCase();
  const sortedKeys = Object.keys(KEYWORD_TO_PROMPT).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (text.includes(key)) return KEYWORD_TO_PROMPT[key];
  }
  return `${FALLBACK_PROMPT}, inspired by "${keyword}" dream element, cinematic, photorealistic`;
}

export default function DreamVision({ keyword, title, streaming, onDone }: DreamVisionProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const prompt = buildPrompt(keyword);
    const seed = hashStr(keyword);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=320&seed=${seed}&nologo=true&enhance=true`;
    setLoaded(false);
    setUrl(url);
  }, [keyword]);

  const handleLoad = () => {
    setLoaded(true);
    onDone?.();
  };

  const handleError = () => {
    setLoaded(true);
    onDone?.();
  };

  return (
    <div className="dream-vision-wrapper">
      {streaming && !loaded && (
        <div className="dream-vision-loading">
          <div className="dream-vision-spinner" />
          <span>AI 正在生成梦境氛围图…</span>
        </div>
      )}
      <img
        ref={imgRef}
        src={url}
        alt={keyword}
        className={`dream-vision ${streaming && !loaded ? 'hidden' : ''}`}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: !streaming ? 1 : (loaded ? 1 : 0),
          transition: 'opacity 0.6s ease-in-out',
        }}
      />
      {keyword && (
        <div className="dream-vision-caption">
          <span className="dream-vision-keyword">{keyword}</span>
        </div>
      )}
    </div>
  );
}
