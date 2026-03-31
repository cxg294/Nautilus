import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

// Since we can't easily import the TS file in a raw JS script, we'll redefine the minimum needed info here.
// We just need the ID and nautilusPrompt.
const styles = [
  { id: 'apple-glass', p: 'A minimalist scene featuring an Apple-style frosted glass display screen. Behind the glass, the Nautilus (鹦鹉螺号) logo is glowing, emitting soft, highly diffused light that scatters beautiful pastel gradients across the matte glass surface.' },
  { id: 'claymorphism', p: 'A charming, round, and cute miniature physical model of the Nautilus (鹦鹉螺号) made entirely of colorful modeling clay. The surface shows highly realistic clay fingerprints and tactile imperfections, cute 3D claymorphism style, soft studio lighting.' },
  { id: 'liquid-metal', p: 'The Nautilus (鹦鹉螺号) formed completely out of flowing, highly reflective liquid metal or chrome. It has organic, fluid curves with perfect mirror reflections of a contrasting studio environment, tension in the liquid droplets.' },
  { id: 'neon-tubes', p: 'A glowing wall sign shaped exactly like the Nautilus (鹦鹉螺号), constructed from bent, bright pink and cyan neon glowing glass tubes. Mounted on a dark, gritty exposed brick wall at night, casting strong colorful light spills.' },
  { id: 'origami-art', p: 'The Nautilus (鹦鹉螺号) crafted elegantly using origami art. Made from crisp, premium matte white and vibrant colored paper with sharp geometric folded edges, creating beautiful soft self-shadows in a clean, brightly lit paper diorama.' },
  { id: 'cyberpunk-water', p: 'The Nautilus (鹦鹉螺号) redesigned as a sleek, flying futuristic sci-fi vehicle, cruising through the night sky of a rain-slicked cyberpunk city filled with towering skyscrapers, holographic neon billboards, and thick blue smog.' },
  { id: 'hologram', p: 'A futuristic floating 3D hologram of the Nautilus (鹦鹉螺号) projected over a dark sci-fi command console. Made entirely of glowing cyan and blue laser lines, data streams, and voxel grids, featuring subtle CRT scanline interference.' },
  { id: 'mecha-heavy', p: 'The Nautilus (鹦鹉螺号) transformed into a massive, heavily armored mecha beast. Covered in intricate grey metallic armor plating, exposed hydraulics, hazard stripes, yellow caution paint, and blasting intense bright orange thruster flames from the rear.' },
  { id: 'retro-futurism', p: 'A shiny, chrome, teardrop-shaped 1950s retro-futuristic rendition of the Nautilus (鹦鹉螺号). It is depicted as a classic sci-fi pulp-magazine spaceship gliding through vibrant outer space near a gas giant with massive rings.' },
  { id: 'circuit-board', p: 'An extreme macro shot where the distinctive spiral shape of the Nautilus (鹦鹉螺号) is meticulously woven into a dark green PCB circuit board layout. Composed of precise golden traces, microchips, glowing LEDs, and solder joints.' },
  { id: 'van-gogh', p: 'An oil painting in the style of Vincent Van Gogh\'s Starry Night. The Nautilus (鹦鹉螺号) is sailing beautifully through a swirling, turbulent ocean of sky-blue and yellow impasto brushstrokes, extremely expressive and thick texture.' },
  { id: 'ink-splash', p: 'Traditional Chinese ink wash painting (Shui-mo). The Nautilus (鹦鹉螺号) gracefully breaking through abstract, misty mountains and waves formed by expressive, elegant splashes of deep black ink on textured rice paper. Empty space (Liu-bai) is utilized beautifully.' },
  { id: 'ukiyo-e', p: 'A classic Japanese Ukiyo-e woodblock print. The Nautilus (鹦鹉螺号) navigating through dramatic, stylized flat claw-like surging ocean waves (like The Great Wave off Kanagawa), rendered in traditional indigo blues, muted reds, and cream colors with fine linework.' },
  { id: 'pop-art', p: 'Andy Warhol inspired bright pop art. The Nautilus (鹦鹉螺号) depicted with striking, exaggerated, high-contrast flat neon colors, surrounded by thick bold black outlines and a background filled with classic retro comic book halftone dot patterns.' },
  { id: 'watercolor', p: 'A gentle, whimsical watercolor illustration of the Nautilus (鹦鹉螺号). The scene feels like a page from a nostalgic children\'s storybook, featuring translucent overlapping pigment washes, soft blurred edges, pastel colors, and visible paper grain.' },
  { id: 'iso-3d', p: 'A highly polished, perfectly aligned 3D isometric view of the Nautilus (鹦鹉螺号) sitting on a clean pastel-colored square podium or grid. Monument Valley style, soft diffuse shadows, impeccable clean vector-like design.' },
  { id: 'minimal-line', p: 'The Nautilus (鹦鹉螺号) drawn using only a single, continuous, elegant thin black line on a pure white background. Extremely minimalist, sleek, high-end design, abstract but instantly recognizable silhouette.' },
  { id: 'corp-memphis', p: 'Corporate Memphis style modern flat vector illustration featuring flat, colorful geometric shapes. An abstract, exaggerated oversized colorful hand gently holding or pointing at a stylized flat Nautilus (鹦鹉螺号) logo. Bright yellows, purples and blues.' },
  { id: 'holo-gradient', p: 'The Nautilus (鹦鹉螺号) embossed seamlessly onto a premium frosted glass or metal credit card. The entire surface shines with a dreamy, fluid holographic iridescent gradient (liquid pastel rainbows) under sleek studio lighting.' },
  { id: 'motion-blur', p: 'The Nautilus (鹦鹉螺号) speeding across the frame like a hyper-car. The image captures intense horizontal motion blur and trailing speed lines on the background, conveying overwhelming sonic speed and momentum, dynamic action shot.' },
  { id: '8bit-pixel', p: '16-bit or 8-bit retro pixel art. The Nautilus (鹦鹉螺号) acting as the player character in a 2D side-scrolling video game, swimming through an underwater level featuring pixelated kelp, bubbles, and UI score elements in the corner.' },
  { id: 'ghibli', p: 'Anime art style by Studio Ghibli. The Nautilus (鹦鹉螺号) reimagined as a majestic, slightly weathered steampunk flying airship covered in lush green creeping vines. It is soaring through a brilliant blue sky alongside massive, fluffy cumulus clouds.' },
  { id: 'cel-shaded', p: 'Breath of the Wild cel-shaded anime video game graphics. The Nautilus (鹦鹉螺号) resting on a bright, lush green grassy cliffside with vibrant blooming flowers. Strong sunlight, distinct cel-shaded cell shadows, and a beautiful blue sky.' },
  { id: 'dark-fantasy', p: 'Dark fantasy, Souls-like grim atmosphere. The Nautilus (鹦鹉螺号) plunging deeply into a dead, ruined abyssal underwater gothic city. It emits an eerie, pale bioluminescent green glow in the oppressive, foggy pitch-black depths.' },
  { id: 'comic-book', p: 'A dynamic panel straight out of a classic retro Western superhero comic book. The Nautilus (鹦鹉螺号) bursting forward across the frame with heavy black ink outlines, dramatic high-contrast spot blacks (chiaroscuro), and vibrant CMYK colors.' },
  { id: 'macro-photo', p: 'Award-winning ultra-macro photography. The Nautilus (鹦鹉螺号) portrayed as an impossibly tiny, highly detailed metallic artifact resting on a large, vibrant green tropical leaf covered in hyper-realistic morning dew drops. Extreme shallow depth of field (bokeh).' },
  { id: 'bw-documentary', p: 'High-contrast black and white dramatic documentary photography, 35mm film grain. The massive Nautilus (鹦鹉螺号) half-docked in a moody, heavy fog-covered industrial harbor. Cold, industrial, stark lighting and moody atmosphere.' },
  { id: 'god-rays', p: 'The Nautilus (鹦鹉螺号) deep inside an immense, atmospheric dark ocean trench or cavern. From far above, powerful god rays (volumetric Tyndall effect light beams) pierce through the murky water, perfectly illuminating the majestic Nautilus.' },
  { id: 'long-exposure', p: 'A long-exposure midnight photography shot. The blazing bright lights of the fast-moving Nautilus (鹦鹉螺号) streak through an urban environment, leaving sweeping, colorful, neon light trails in the air like a mesmerizing glowing ribbon.' },
  { id: 'studio-lighting', p: 'Commercial Apple-style product photography. The Nautilus (鹦鹉螺号) elegantly displayed against pitch black empty space. It is illuminated entirely by a razor-thin, dramatic white rim light highlighting its perfect spiraling spiral curves and silhouette.' },
  { id: 'felt-toy', p: 'A highly detailed and heart-warming needle-felted wool toy of the Nautilus (鹦鹉螺号). Visible fuzz, individual soft woolen fibers, and cute handmade stitching details. Sitting on a cozy wooden desk under a warm lamp.' },
  { id: 'stained-glass', p: 'The image of the Nautilus (鹦鹉螺号) masterfully depicted within an intricate Gothic cathedral stained glass window. Composed of vibrant, glowing mosaic shards of jewel-toned glass held together by thick dark lead lines. Sunlight shines heavily through it.' },
  { id: 'sand-art', p: 'Cinematic sand animation art on a glowing light box. The silhouette and internal spirals of the Nautilus (鹦鹉螺号) formed entirely by carefully arranged coarse and fine grains of brown sand, featuring beautiful textured gradients and scattered loose grains.' },
  { id: 'wood-carving', p: 'A masterful artisan wooden carving of the Nautilus (鹦鹉螺号) sculpted directly from a rich mahogany timber block. Beautiful concentric natural wood grain, visible subtle chisel tool marks, coated in a warm, glossy protective varnish.' },
  { id: 'ice-sculpture', p: 'A breathtakingly intricate ice sculpture of the Nautilus (鹦鹉螺号). Carved from crystal clear glacial ice that wildly refracts cool blue ambient light. The ice features tiny trapped frozen bubbles, melting slightly with frost.' },
  { id: 'cthulhu', p: 'Lovecraftian horror, Cthulhu Mythos style. The Nautilus (鹦鹉螺号) corrupted and mutated into a grotesque, organic biological nightmare. Dripping with massive alien tentacles, barnacles, and covered in pulsing eyes, surrounded by dark muddy waters.' },
  { id: 'steampunk', p: 'Elaborate Victorian steampunk engineering. The Nautilus (鹦鹉螺号) constructed from tarnished brass, copper gears, cogs, analog dial meters, and thick riveted iron plates, puffing out thick volumetric white steam from miniature smokestacks.' },
  { id: 'fluid-art', p: 'Abstract acrylic fluid pour art. The distinct spiral form of the Nautilus (鹦鹉螺号) naturally emerging from mesmerizing, unpredictable swirling marbled patterns of liquid gold, intense blue, and magenta paint bleeding organically into one another.' },
  { id: 'multiple-exposure', p: 'Surreal double-exposure photography. Using the bold silhouette shape of the Nautilus (鹦鹉螺号) as a mask, the inside of the shape reveals an entirely different breathtaking scene: a massive bustling glowing metropolis skyline at night, seamlessly blended.' },
  { id: 'surrealism', p: 'Salvador Dali inspired surrealism painting. An absurd, dream-like landscape where a gigantic, soft, melting Nautilus (鹦鹉螺号) droops over the edge of an empty, vast desert. In the sky hangs giant floating eyeballs and long-legged elephants.' }
];

const OUTPUT_DIR = path.resolve(__dirname, '../public/images/styles');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateImage(styleId, promptStr) {
  const outputPath = path.join(OUTPUT_DIR, `${styleId}.png`);
  if (fs.existsSync(outputPath)) {
    console.log(`Skipping ${styleId}, already exists.`);
    return;
  }

  console.log(`Generating for ${styleId}...`);
  const fullPrompt = `Generate a square image thumbnail based on this description:\n\n${promptStr}\n\nHigh quality, detailed, professional.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview', // Use the image model as defined in backend
      contents: [{ text: fullPrompt }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, buffer);
          console.log(`✅ Success: ${styleId}`);
          return;
        }
      }
    }
    console.error(`❌ Failed: ${styleId} - no image returned`);
  } catch (err) {
    console.error(`❌ Error on ${styleId}:`, err.message);
  }
}

async function main() {
  console.log(`Starting generation of ${styles.length} thumbnails...`);
  
  // Generating in chunks of 5 to avoid rate limits / overwhelming the network
  const CHUNK_SIZE = 5;
  for (let i = 0; i < styles.length; i += CHUNK_SIZE) {
    const chunk = styles.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(s => generateImage(s.id, s.p)));
  }
  
  console.log('All done!');
}

main().catch(console.error);
