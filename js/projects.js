// ---------------------------------------------------------------------------
// PROJECT DATA — edit this file to add, remove or reorder projects.
//
// videos: list of embeds. Supported:
//   { type: "youtube", id: "VIDEO_ID" }            (from youtube.com/watch?v=VIDEO_ID)
//   { type: "vimeo",   id: "123456789" }
//   { type: "adobe",   id: "HGudHrkt8pH" }          (Behance-hosted video)
//   { type: "file",    src: "assets/video/x.mp4" }  (self-hosted, keep < 100 MB)
// highlights: optional { title, text, video? } blocks shown inside the project.
// ---------------------------------------------------------------------------

window.PROJECTS = [
  {
    slug: "gabbys-dollhouse",
    featured: true,
    title: "Gabby's Dollhouse: Cat Games",
    tagline: "Physics-driven playsets for DreamWorks' preschool hit, shipped on iOS and Android.",
    role: "Senior Game Developer",
    studio: "Scubalight / Amber co-dev with Sago Mini",
    period: "2025 – 2026",
    tech: "Unity · iOS · Android",
    cover: "assets/img/gabby.jpg",
    description:
      "Co-developed with Play Piknik's Sago Mini team on a game based on the DreamWorks animated series. Launched on Google Play and the App Store and very well received by its audience (kids aged 2–5). I built gameplay features across many playsets and integrated QR code scanning for the in-game prize claim system.",
    videos: [{ type: "youtube", id: "oR6BM7MrVrQ" }],
    highlights: [
      {
        title: "Bouncing VFX",
        text: "Using Sago's internal physics and animated-physics packages, balls and bouncy pieces squash and stretch based on impact force or current velocity, following animation principles for convincing feedback.",
        video: { type: "adobe", id: "HGudHrkt8pH" }
      },
      {
        title: "Sprite swapping on snap system",
        text: "Pieces read the identifier of the socket they snap to (or detach from) and trigger designer-configurable actions such as sprite swaps, set separately for snap and detach events.",
        video: { type: "adobe", id: "QnH5KyMMxSL" }
      },
      {
        title: "Musical instruments sync system",
        text: "Attaching instruments to a character's hands plays that instrument's track, kept in sync with every other instrument and with the playset's background music, even when the player switches or mutes the music.",
        video: { type: "adobe", id: "5jzsPDLxPss" }
      },
      {
        title: "Dancing on spot system",
        text: "Characters dance when snapped to dance spots. Per-bone pose pairs are lerped with configurable speed and animation curves, layered so they never fight the look-at or reaching animations.",
        video: { type: "adobe", id: "9vii2v2QCUy" }
      }
    ]
  },
  {
    slug: "jinjas-garden",
    featured: true,
    title: "Jinja's Garden",
    tagline: "Gameplay, editor tools and tech art for a Sago Mini title on Apple Arcade.",
    role: "Senior Game Developer",
    studio: "Scubalight / Amber co-dev with Sago Mini",
    period: "2025 – 2026",
    tech: "Unity · Apple Arcade",
    cover: "assets/img/jinja.png",
    description:
      "Released on Apple devices as part of Apple Arcade. I worked on gameplay mechanics, built Unity Editor tools for the design and technical art teams, and integrated other teams' tools into Sago's build pipeline.",
    videos: [{ type: "youtube", id: "5bJ5LwJcWHU" }],
    highlights: [
      {
        title: "UI items look-at mechanic",
        text: "Let the player character's look-at system track UI elements living in canvas space instead of world space, later extended to every in-game character.",
        video: { type: "adobe", id: "5uq2poYjD9u" }
      },
      {
        title: "Outlined number sprite shader",
        text: "A UI shader that recolours outlined number and letter sprites, with independent colours for the outline and the inner line.",
        video: { type: "adobe", id: "RCtvJvaH-JQ" }
      },
      {
        title: "Harvesting giant food with physics",
        text: "Rare giant crops stay on the field after harvest as physics objects that interact with the player and environment, then explode after a lifetime, with an explosion animation and event-driven VFX.",
        video: { type: "adobe", id: "V9F7SB4vjgE" }
      }
    ]
  },
  {
    slug: "coin-dozer",
    featured: true,
    title: "Coin Dozer",
    tagline: "Live-ops features and shaders for a 100M+ download mobile classic.",
    role: "Senior Game Developer",
    studio: "RM2 · Monumental / Game Circus",
    period: "2023 – 2025",
    tech: "Unity · iOS · Android",
    cover: "assets/img/coindozer.png",
    description:
      "Maintenance and new features for Coin Dozer (100M+ downloads): the Coin Dozer: Haunted Halloween event, migrating from the old purchasing system to Unity IAP with new subscription options, and new shader effects. Helped keep a 4.2-star rating and crash rates below 0.5%.",
    videos: [
      { type: "youtube", id: "7tMlJPTA9_s" },
      { type: "youtube", id: "4cBi3f6R3W4" }
    ],
    gallery: [
      "assets/img/coindozer-b4599c222006687.67de0d062c877.jpg",
      "assets/img/coindozer-268e2b222006687.67de11be4aae1.png",
      "assets/img/coindozer-95dd46222006687.67de11be4b207.png"
    ]
  },
  {
    slug: "coin-dozer-casino",
    featured: true,
    title: "Coin Dozer: Casino",
    tagline: "IAP migration, asset bundles and AWS improvements for a 10M+ title.",
    role: "Senior Game Developer",
    studio: "RM2 · Monumental / Game Circus",
    period: "2023 – 2025",
    tech: "Unity · AWS · Unity IAP",
    cover: "assets/img/coindozer-casino.png",
    description:
      "General maintenance and new features for Coin Dozer: Casino (10M+ downloads): migrating from the old purchasing system to Unity IAP, improving bundle downloading and communication with AWS, and adding new shader effects.",
    videos: [{ type: "youtube", id: "V7iafNHT9PA" }],
    gallery: [
      "assets/img/casino-099604222007523.67de149ae0642.png",
      "assets/img/casino-a535e5222007523.67de149ae021a.jpg",
      "assets/img/casino-c92349222007523.67de149adfa16.jpg"
    ]
  },
  {
    slug: "logicubes",
    title: "Logicubes: The Path",
    tagline: "Turn-based puzzle game: UI, animation, saving and progression.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2017 – 2022",
    tech: "Unity · Mobile",
    cover: "assets/img/logicubes.jpg",
    description:
      "Logicubes: Turn-Based Puzzle. I focused on UI behaviour, animations, the saving and progression system and several of the core game mechanics.",
    videos: [{ type: "youtube", id: "oxc7e5lKBzg" }]
  },
  {
    slug: "desafio-ole",
    title: "Desafío Olé",
    tagline: "Gamified app for Olé, taken through final release on iOS and Android.",
    role: "Tech Lead",
    studio: "TGA",
    period: "2022 – 2023",
    tech: "Unity · Client–server",
    cover: "assets/img/desafio-ole.jpg",
    description:
      "Technical Lead for the game's final release stage on both iOS and Android, part of a line of client–server training and educational games with accounts, leaderboards and progress sync.",
    videos: [{ type: "youtube", id: "jGNFDKenHjA" }]
  },
  {
    slug: "vial-security",
    title: "Vial Security",
    tagline: "Driving safety simulator for PC and VR with hand tracking.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2021",
    tech: "Unity · VR · PC",
    cover: "assets/img/vial-security.png",
    description:
      "A simulator that recreates common driving situations such as rain or driving drunk, and evaluates mistakes like speeding and running traffic lights. Playable in VR with hand tracking or on PC.",
    videos: [
      { type: "youtube", id: "Ctt-9T1OSvI", start: 118 },
      { type: "youtube", id: "njfQVCf_amc" },
      { type: "youtube", id: "DhKsTKb_4oE" }
    ]
  },
  {
    slug: "icecream",
    title: "IceCream",
    tagline: "Memory and speed game built for Teleperformance.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2022",
    tech: "Unity",
    cover: "assets/img/icecream.png",
    description:
      "A game for Teleperformance where you memorise customers' orders and prepare them as fast as you can.",
    videos: [{ type: "adobe", id: "WQSp7mL3Q6K" }],
    gallery: [
      "assets/img/icecream-297a20153653179.6333a4b43e971.png",
      "assets/img/icecream-b0e9d7153653179.6333a4b43f853.png",
      "assets/img/icecream-354bd1153653179.6333a4b43ff98.png"
    ]
  },
  {
    slug: "archery-vr",
    title: "Archery VR",
    tagline: "VR archery game.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2021",
    tech: "Unity · VR",
    cover: "assets/img/archery-vr.png",
    description: "A VR archery game developed at Indie Level Studio.",
    videos: [{ type: "adobe", id: "MvE9jqT2HHZ" }],
    gallery: [
      "assets/img/archery-039bef115437211.604ed147e3ec5.png",
      "assets/img/archery-35b817115437211.604ed147e5253.png",
      "assets/img/archery-55ab02115437211.604ed147e4bb9.png"
    ]
  },
  {
    slug: "space-ascent",
    title: "Space Ascent",
    tagline: "Space-themed game.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2021",
    tech: "Unity",
    cover: "assets/img/space-ascent.png",
    description: "A space-themed game developed at Indie Level Studio.",
    videos: [{ type: "adobe", id: "CZ38W-Br-zH" }],
    gallery: [
      "assets/img/space-3258ce116526311.6063a380acd0a.png",
      "assets/img/space-1d3fdf116526311.6063a380aa7f8.png",
      "assets/img/space-020188116526311.6063a380ac848.png"
    ]
  },
  {
    slug: "world-cuisine",
    title: "World Cuisine",
    tagline: "Cooking game around dishes from around the world.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2021",
    tech: "Unity",
    cover: "assets/img/world-cuisine.png",
    description: "A cooking game developed at Indie Level Studio.",
    videos: [{ type: "youtube", id: "pjal6VCxuvs" }],
    gallery: [
      "assets/img/cuisine-47a7c3115674507.6052e32d813d8.png",
      "assets/img/cuisine-d2a2ec115674507.6052e32d8727f.png",
      "assets/img/cuisine-3d208f115674507.6052e32d85283.png"
    ]
  },
  {
    slug: "idea",
    title: "Idea",
    tagline: "Game developed at Indie Level Studio.",
    role: "Tech Lead",
    studio: "Indie Level Studio",
    period: "2021",
    tech: "Unity",
    cover: "assets/img/idea.png",
    description: "A game developed at Indie Level Studio.",
    videos: [{ type: "adobe", id: "SSzEijhEa4t" }],
    gallery: [
      "assets/img/idea-94052b115015309.60467c9f66f3a.png",
      "assets/img/idea-6610a3115015309.60467c9f66762.png",
      "assets/img/idea-0c06b1115015309.60467c9f674b8.png"
    ]
  }
];

// ---------------------------------------------------------------------------
// LIVE GAMES: the "Live on stores" section. Clicking the icon opens the first
// store; every store also gets its own button.
// store: "appstore" | "googleplay" | "steam"
// ---------------------------------------------------------------------------
window.LIVE_GAMES = [
  {
    title: "Gabby's Dollhouse: Cat Games",
    icon: "assets/img/icons/gabby.jpg",
    note: "Sago Mini · DreamWorks",
    stores: [
      { store: "appstore", url: "https://apps.apple.com/us/app/gabbys-dollhouse-cat-games/id1488385103" },
      { store: "googleplay", url: "https://play.google.com/store/apps/details?id=com.spinmaster.gabbysdollhouse" }
    ]
  },
  {
    title: "Sago Mini Jinja's Garden",
    icon: "assets/img/icons/jinja.jpg",
    note: "Apple Arcade",
    stores: [
      { store: "appstore", url: "https://apps.apple.com/us/app/sago-mini-jinjas-garden/id6477492925" }
    ]
  },
  {
    title: "Coin Dozer",
    icon: "assets/img/icons/coindozer.jpg",
    note: "Game Circus · 100M+ downloads",
    stores: [
      { store: "googleplay", url: "https://play.google.com/store/apps/details?id=com.leftover.CoinDozer" },
      { store: "appstore", url: "https://apps.apple.com/us/app/coin-dozer/id372836496" }
    ]
  },
  {
    title: "Logicubes",
    icon: "assets/img/icons/logicubes.png",
    note: "Indie Level Studio",
    stores: [
      { store: "steam", url: "https://store.steampowered.com/app/1856120/Logicubes/" },
      { store: "googleplay", url: "https://play.google.com/store/apps/details?id=com.IndieLevelStudio.TestProject" }
    ]
  }
];
