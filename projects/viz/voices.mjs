import {sample} from './score.mjs?v=songs1';

// Pick a coordinated family, then vary each instrument within conservative
// ranges. Dedicated lanes keep timbres independent of score/scheduler order.
export function voicePalette(seed) {
  const r=lane=>sample(seed,0,4000+lane);
  const family=Math.floor(r(0)*3); // warm analog, hollow electronic, glass
  return {
    bass:{wave:['sawtooth','square','triangle'][family],cutoff:280+r(1)*420,
      q:.55+r(2)*.7,attack:.012+r(3)*.014,release:.12+r(4)*.12},
    bell:{wave:['triangle','sine','sine'][family],cutoff:1500+r(5)*2400,
      q:.5+r(6)*1.1,ratio:[1,2,3][family]+r(7)*.008,
      depth:[.3,.7,1.15][family]+r(8)*.3,attack:.006+r(9)*.012,
      release:.35+r(10)*.35},
    pad:{wave:['sawtooth','triangle','sine'][family],cutoff:650+r(11)*1100,
      detune:3+r(12)*7,attack:.55+r(13)*.35,release:.8+r(14)*.4},
    reed:{wave:['square','square','triangle'][family],cutoff:1000+r(15)*1600,
      q:.65+r(16)*1.2,attack:.035+r(17)*.065,release:.18+r(18)*.22},
    echo:.19+r(19)*.10
  };
}
