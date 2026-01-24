export interface TeamData {
  [league: string]: {
    [teamName: string]: string[];
  };
}

export const TEAMS: TeamData = {
  "LEC": {
    "Fnatic": ["Empyros", "Razork", "Vladi", "Upset", "Lospa"],
    "G2 Esports": ["BrokenBlade", "SkewMond", "Caps", "Hans Sama", "Labrov"],
    "GIANTX": ["Lot", "ISMA", "Jackies", "Noah", "Jun"],
    "Karmine Corp": ["Canna", "Yike", "kyeahoo", "Caliste", "Busio"],
    "Movistar KOI": ["Myrwn", "Elyoya", "Jojopyun", "Supa", "Alvaro"],
    "Natus Vincere": ["Maynter", "Rhilech", "Poby", "SamD", "Parus"],
    "Shifters": ["Rooster", "Boukada", "nuc", "Paduck", "Trymbi"],
    "SK Gaming": ["Wunder", "Skeanz", "LIDER", "Jopa", "Mikyx"],
    "Team Heretics": ["Tracyn", "Sheo", "Serin", "Ice", "Stend"],
    "Team Vitality": ["Naak Nako", "Lyncas", "Humanoid", "Carzzy", "Fleshy"],
    "Los Ratones": ["Baus", "Velja", "Nemesis", "Crownie", "Rekkles"],
    "Karmine Corp Blue": ["Tao", "Yukino", "Kamiloo", "Hazel", "Prime"]
  },
  "LPL": {
    "Anyone's Legend": ["Flandre", "Tarzan", "Shanks", "Hope", "Kael"],
    "BILIBILI GAMING DREAMSMART": ["Bin", "Xun", "Knight", "Viper", "ON"],
    "Invictus Gaming": ["Soboro", "Wei", "Rookie", "Photic", "Jwei"],
    "Beijing JDG Intel Esports": ["Xiaoxu", "JunJia", "HongQ", "GALA", "Vampire"],
    "TopEsports": ["369", "naiyou", "Creme", "JiaQi", "fengyue"],
    "WeiboGaming Faw Audi": ["Zika", "Jiejie", "Xiaohu", "Elk", "Erha"],
    "SHANGHAI EDWARD GAMING HYCAN": ["Zdz", "Xiaohao", "Angel", "Leave", "Parukia"],
    "Ninjas in Pyjamas.CN": ["HOYA", "Guwon", "Care", "Assum", "Zhuo"],
    "Xi'an Team WE": ["Cube", "Monki", "Karis", "About", "yaoyao"],
    "THUNDERTALKGAMING": ["Keshi", "Junhao", "Heru", "Ryan3", "Feather"],
    "Hangzhou LGD Gaming": ["sasi", "Heng", "Tangyuan", "Shaoye", "Ycx"],
    "Suzhou LNG Ninebot Esports": ["sheer", "Croco", "BuLLDoG", "1xn", "MISSING"],
    "Oh My God": ["Hery", "Juhan", "haichao", "Starry", "Moham"],
    "Ultra Prime": ["Liangchen", "Grizzly", "Saber", "Hena", "Xiaoxia"]
  },
  "LCK": {
    "BNK FEARX": ["Clear", "Raptor", "VicLa", "Diable", "Kellin"],
    "BRION": ["Casting", "GIDEON", "Roamer", "Teddy", "Namgung"],
    "DN SOOPers": ["DuDu", "Pyosik", "Clozer", "deokdam", "Life", "Peter"],
    "Dplus Kia": ["Siwoo", "Lucid", "ShowMaker", "Smash", "Career"],
    "DRX": ["Rich", "Willer", "Ucal", "Jiwoo", "Andil"],
    "Gen.G Esports": ["Kiin", "Canyon", "Chovy", "Ruler", "Duro"],
    "Hanwha Life Esports": ["Zeus", "Kanavi", "Zeka", "Gumayusi", "Delight"],
    "KT Rolster": ["PerfecT", "Cuzz", "Bdd", "Aiming", "Pollu", "Ghost"],
    "NS RedForce": ["Kingen", "Sponge", "Scout", "Taeyoon", "Lehends"],
    "T1": ["Doran", "Oner", "Faker", "Peyz", "Keria"]
  },
  "LCS": {
    "Cloud9 Kia": ["Thanatos", "Blaber", "APA", "Zven", "Vulcan"],
    "Dignitas": ["Photon", "eXyu", "Palafox", "Mobility", "Breezy"],
    "FlyQuest": ["Gakgos", "Gryffinn", "Quad", "Massu", "Cryogen"],
    "LYON": ["Dhokla", "Inspired", "Saint", "Berserker", "Isles"],
    "Sentinels": ["Impact", "HamBak", "DARKWINGS", "Rahel", "huhi"],
    "Shopify Rebellion": ["Fudge", "Contractz", "Zinie", "Bvoy", "Ceos"],
    "Team Liquid": ["Morgan", "Josedeodo", "Quid", "Yeon", "CoreJJ"],
    "Disguised": ["Castle", "KryRa", "Callme", "sajed", "Lyonz"]
  }
};

export const LEAGUES = Object.keys(TEAMS);

export const getTeamLogo = (teamName: string) => {
  // Map special cases or just replace spaces with underscores
  let filename = teamName.replace(/ /g, "_");
  
  // Special handling based on the file list I saw
  if (teamName === "BNK FEARX") filename = "BNK_FearX";
  if (teamName === "Dplus Kia") filename = "Dplus_KIA";
  if (teamName === "Ninjas in Pyjamas.CN") filename = "Ninjas_in_Pyjamas.CN";
  if (teamName === "BILIBILI GAMING DREAMSMART") filename = "BILIBILI_GAMING_DREAMSMART";
  if (teamName === "Anyone's Legend") filename = "Anyone's_Legend";
  if (teamName === "Beijing JDG Intel Esports") filename = "Beijing_JDG_Intel_Esports";
  if (teamName === "WeiboGaming Faw Audi") filename = "WeiboGaming_Faw_Audi";
  if (teamName === "SHANGHAI EDWARD GAMING HYCAN") filename = "SHANGHAI_EDWARD_GAMING_HYCAN";
  if (teamName === "Xi'an Team WE") filename = "Xi'an_Team_WE";
  if (teamName === "Hangzhou LGD Gaming") filename = "Hangzhou_LGD_Gaming";
  if (teamName === "Suzhou LNG Ninebot Esports") filename = "Suzhou_LNG_Ninebot_Esports";
  
  const webpTeams = ["Shifters", "NS RedForce", "Sentinels"];
  const extension = webpTeams.includes(teamName) ? "webp" : "png";
  return `/team_logos/${filename}.${extension}`;
};
