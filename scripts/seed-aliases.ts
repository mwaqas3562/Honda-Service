/**
 * Seed aliases for common Honda bike parts
 * Maps English part names to local (Urdu/Punjabi/mechanic slang) aliases
 * Run: npx tsx scripts/seed-aliases.ts
 */

import { config } from "dotenv";
config(); // Load .env

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set");
console.log("Connecting to:", dbUrl.replace(/:[^:@]+@/, ":***@"));

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// Pattern → aliases mapping
// Each key is a regex pattern matched against part name (case-insensitive)
// Aliases are local names mechanics/customers commonly use
const aliasMap: [RegExp, string[]][] = [
  // ─── Engine Parts ───
  [/\bPISTON KIT\b/, ["piston", "pistin"]],
  [/\bRING SET\b/, ["ring", "challa"]],
  [/\bCYLINDER\b(?!.*HEAD)/, ["cylinder", "silinder", "boor"]],
  [/\bCYLINDER HEAD\b/, ["cylinder head", "silinder head", "head"]],
  [/\bGASKET\b/, ["gasket", "packing"]],
  [/\bGASKET CYL\b/, ["top packing", "cylinder packing"]],
  [/\bGASKET HALF\b/, ["half packing", "half gasket"]],
  [/\bVALVE SET\b/, ["valve", "walve"]],
  [/\bVALVE SEAL\b/, ["valve seal", "walve seal", "valve ki seal"]],
  [/\bVALVE CARTER\b/, ["valve carter", "carter"]],
  [/\bVALVE KATORI\b/, ["katori", "valve katori"]],
  [/\bROCKER\b/, ["rocker", "rokar"]],
  [/\bTAPET\b/, ["tappet", "tapet"]],
  [/\bCAM SHAFT\b/, ["cam", "cam shaft"]],
  [/\bCONNECTING ROD\b/, ["connecting rod", "con rod", "rod"]],
  [/\bCRANK SHAFT\b/, ["crank", "crank shaft"]],
  [/\bENGINE OIL\b/, ["oil", "mobil", "mobil oil", "engine oil"]],
  [/\bOIL FILTER\b/, ["oil filter", "filter oil"]],
  [/\bOIL PUMP\b/, ["oil pump", "pump"]],
  [/\bOIL SEAL\b/, ["oil seal", "seal"]],
  [/\bPLUG\b/, ["plug", "spark plug", "plag"]],

  // ─── Clutch & Transmission ───
  [/\bCLUTCH PLATE\b/, ["clutch plate", "plate", "clutch ki plate"]],
  [/\bCLUTCH CABLE\b/, ["clutch wire", "clutch cable", "clutch ki wire"]],
  [/\bCLUTCH\b(?!.*CABLE|.*PLATE|.*HOUSING|.*BOX|.*SPRING|.*CENTER)/, ["clutch"]],
  [/\bCLUTCH SPRING\b/, ["clutch spring", "clutch ki spring"]],
  [/\bCLUTCH CENTER\b/, ["clutch center", "center"]],
  [/\bCLUTCH HOUSING\b/, ["clutch housing", "housing"]],
  [/\bGEAR\b(?!.*SHIFT)/, ["gear", "gari", "garari"]],
  [/\bGEAR SHIFT\b/, ["gear shift", "gear lever"]],
  [/\bPRESSURE PLATE\b/, ["pressure plate"]],

  // ─── Chain & Sprocket ───
  [/\bCHAIN\b(?!.*TIMING|.*BOLT|.*COVER|.*GARARI|.*ADJUSTER|.*LOCK)/, ["chain", "zanjeer"]],
  [/\bCHAIN GARARI SET\b/, ["chain sprocket set", "chain set", "gutka set", "garari set"]],
  [/\bSPROCKET\b/, ["sprocket", "gutka"]],
  [/\bTIMING CHAIN\b/, ["timing chain", "timing"]],
  [/\bTIMING GOOT\b/, ["timing goot", "timing gear"]],
  [/\bCHAIN COVER\b/, ["chain cover", "chain guard"]],
  [/\bCHAIN ADJUSTER\b/, ["chain adjuster", "tightener"]],

  // ─── Brakes ───
  [/\bBRAKE CABLE\b/, ["brake wire", "brake cable", "brake ki wire"]],
  [/\bBRAKE SHOE\b/, ["brake shoe", "shoe", "juta"]],
  [/\bBRAKE PEDAL\b/, ["brake pedal", "pedal"]],
  [/\bBRAKE CAM\b/, ["brake cam"]],
  [/\bDISK PAD\b/, ["disk pad", "disc pad", "pad"]],
  [/\bBRAKE LEVER\b/, ["brake lever", "brake ka lever"]],
  [/\bPANEL BRAKE\b/, ["brake panel", "panel"]],

  // ─── Electrical ───
  [/\bHEAD LIGHT BULB\b/, ["headlight bulb", "bulb", "agay wala bulb"]],
  [/\bHEAD LIGHT\b(?!.*BULB|.*HOLDER|.*RING|.*GLASS|.*VISOR)/, ["headlight", "head light", "agay wali light"]],
  [/\bTAIL LIGHT\b(?!.*BULB|.*HOLDER|.*BRACKET|.*COVER)/, ["tail light", "peechay wali light", "back light"]],
  [/\bTAIL LIGHT BULB\b/, ["tail bulb", "peechay wala bulb", "back bulb"]],
  [/\bWINKER\b(?!.*RUBBER|.*COVER|.*BULB|.*PATRI)/, ["indicator", "winker", "blinker"]],
  [/\bWINKER BULB\b/, ["indicator bulb", "winker bulb"]],
  [/\bFLASHER\b/, ["flasher", "indicator relay"]],
  [/\bHORN\b/, ["horn", "hooter"]],
  [/\bBATTERY\b(?!.*COVER|.*FUSE|.*PIPE|.*DEVICE)/, ["battery", "baitri"]],
  [/\bMAGNET COIL\b/, ["coil", "magnet coil"]],
  [/\bCDI UNIT\b/, ["CDI", "cdi unit"]],
  [/\bRECTIFIER\b/, ["rectifier", "regulator"]],
  [/\bSWITCH ASSY\b/, ["switch", "button"]],
  [/\bWIRING\b/, ["wiring", "wiring harness", "wire set"]],
  [/\bFUSE\b/, ["fuse"]],
  [/\bSELF MOTOR\b/, ["self", "self motor", "starter motor"]],

  // ─── Suspension & Frame ───
  [/\bFRONT FORK\b(?!.*RING|.*BOLT|.*SEAL|.*OIL|.*PIPE)/, ["shocker agay", "front fork", "fork"]],
  [/\bCUSHION ASSY REAR\b/, ["shocker peechay", "rear shocker", "shock absorber"]],
  [/\bSWING ARM\b/, ["swing arm", "arm"]],
  [/\bSTEERING\b/, ["steering", "handle bearing"]],
  [/\bMAIN STAND\b/, ["main stand", "center stand", "stand"]],
  [/\bSIDE STAND\b/, ["side stand", "side ka stand"]],
  [/\bMUDGUARD FRONT\b/, ["mudguard front", "agay wala mudguard", "fender"]],
  [/\bMUDGUARD REAR\b/, ["mudguard rear", "peechay wala mudguard"]],
  [/\bFENDER\b/, ["fender", "mudguard"]],

  // ─── Wheels & Tyres ───
  [/\bTYRE FRONT\b/, ["agay wala tyre", "front tyre"]],
  [/\bTYRE REAR\b/, ["peechay wala tyre", "rear tyre"]],
  [/\bTUBE\b(?!.*BREATHER)/, ["tube"]],
  [/\bSPOKE\b/, ["spoke", "taar"]],
  [/\bRIM\b/, ["rim", "wheel"]],
  [/\bWHEEL GOOT\b/, ["wheel bearing", "wheel goot"]],
  [/\bHUB\b/, ["hub", "dhol"]],
  [/\bBALL BEARING\b/, ["bearing", "goot"]],

  // ─── Carburetor & Fuel ───
  [/\bCARBURATOR\b(?!.*CHOWK|.*RACE|.*REPAIR|.*DIAPHRAGM)/, ["carburetor", "carbu"]],
  [/\bCARBURATOR REPAIR\b/, ["carburetor kit", "carbu repair kit"]],
  [/\bPETROL PIPE\b/, ["petrol pipe", "fuel pipe"]],
  [/\bFUEL COCK\b/, ["fuel cock", "tap", "petrol tap"]],
  [/\bAIR FILTER\b/, ["air filter", "filter"]],

  // ─── Body Parts ───
  [/\bSEAT\b(?!.*COVER)/, ["seat", "gaddi"]],
  [/\bSEAT COVER\b/, ["seat cover", "gaddi cover"]],
  [/\bFUEL TANK\b(?!.*WASHING)/, ["tank", "petrol tank"]],
  [/\bSAFEGUARD\b/, ["safeguard", "leg guard"]],
  [/\bVISOR\b(?!.*SCREEN)/, ["visor", "front visor"]],
  [/\bMIRROR\b/, ["mirror", "sheesha"]],
  [/\bSIDE COVER\b/, ["side cover"]],
  [/\bMONOGRAM\b/, ["monogram", "sticker", "badge"]],
  [/\bEMBLEM\b/, ["emblem", "logo", "nishan"]],

  // ─── Handle & Controls ───
  [/\bHANDLE\b(?!.*LEVER|.*CUP|.*GRIP|.*LOCK|.*CUSHION|.*WEIGHT|.*BAR)/, ["handle"]],
  [/\bHANDLE GRIP\b/, ["grip", "handle grip", "handle ka grip"]],
  [/\bHANDLE LEVER\b/, ["lever", "handle lever"]],
  [/\bHANDLE LOCK\b/, ["handle lock", "lock"]],
  [/\bHANDLE WEIGHT\b/, ["weight", "handle weight"]],
  [/\bTHROTTLE CABLE\b/, ["race wire", "throttle wire", "accelerator wire"]],
  [/\bSPEEDOMETER\b(?!.*CABLE)/, ["speedometer", "meter"]],
  [/\bSPEEDOMETER CABLE\b/, ["meter cable", "meter wire"]],
  [/\bKEY SET\b/, ["key set", "chabi set"]],

  // ─── Kickstart & Misc ───
  [/\bKICK\b(?!.*BOLT|.*RUBBER|.*SPRING|.*SPINDLE|.*LEVER)/, ["kick", "kick start"]],
  [/\bKICK RUBBER\b/, ["kick rubber", "kick ka rubber"]],
  [/\bKICK SPRING\b/, ["kick spring"]],
  [/\bSPINDLE KICK\b/, ["kick shaft", "kick spindle"]],
  [/\bEXHAUST\b|MUFFLER/, ["silencer", "exhaust"]],
  [/\bFOOT REST\b/, ["footrest", "pair"]],
  [/\bNUT\b(?!.*RAL)/, ["nut"]],
  [/\bBOLT\b(?!.*ENGINE)/, ["bolt"]],
  [/\bWASHAL\b/, ["washer", "washal"]],
  [/\bSPRING\b(?!.*BRAKE|.*CLUTCH|.*KICK|.*SIDE|.*MAIN|.*TENSSION)/, ["spring"]],
  [/\bSEAL\b(?!.*VALVE|.*OIL|.*KICK)/, ["seal"]],
  [/\bRUBBER\b(?!.*BELT|.*HANDLE|.*KICK|.*WINKER|.*BAR)/, ["rubber"]],
];

async function seedAliases() {
  const parts = await prisma.part.findMany({
    select: { id: true, name: true, aliases: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const part of parts) {
    const newAliases: Set<string> = new Set(part.aliases || []);
    let matched = false;

    for (const [pattern, aliases] of aliasMap) {
      if (pattern.test(part.name)) {
        matched = true;
        for (const alias of aliases) {
          newAliases.add(alias);
        }
      }
    }

    if (matched && newAliases.size > (part.aliases?.length || 0)) {
      await prisma.part.update({
        where: { id: part.id },
        data: { aliases: Array.from(newAliases) },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`✅ Updated ${updated} parts with aliases`);
  console.log(`⏭️  Skipped ${skipped} parts (no matching pattern or already had aliases)`);
}

seedAliases()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
