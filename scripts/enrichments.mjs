// Per-attraction enrichments: coordinates and English translations.
// Keys are IDs from data/attractions.base.json (see scripts/prepare-data.mjs).
// `full_en` is a faithful but condensed English version of the Russian
// transcript paragraph — it preserves the facts, not the exact wording.

export const ENRICHMENTS = {
  // ── Большие города ──
  amsterdam: {
    coordinates: { lat: 52.3676, lng: 4.9041 },
    name_en: 'Amsterdam',
    short_en: 'Capital, “Venice of the North”: 17th-century canals, floating and “dancing” houses, ~900,000 bicycles, A’DAM Lookout, Rijksmuseum, NEMO.',
    full_en: 'Amsterdam is the official capital of the Netherlands and one of Europe’s major cultural and economic hubs, often called the “Venice of the North.” In the 17th century it became one of the most important cities on the planet, launching the Dutch Golden Age. Its historic centre is wrapped in a vast network of canals laid out during the Golden Age to support trade and defence. After WWII a severe housing shortage led people to live on boats, and what began as a stopgap turned into a way of life. The so-called “dancing houses” are old canal-side homes built on wooden piles; ground subsidence has tilted some of them forward, backward, or sideways. The city has around 900,000 bicycles — more than residents — both transport and cultural symbol. Centraal Station is the heart of the country’s transport network. Across from it, on the north bank of the IJ, stands the A’DAM Lookout tower with a swing on the roof. The Rijksmuseum holds masterpieces by Rembrandt, Vermeer, Frans Hals and other Golden Age icons; NEMO, the country’s largest science museum, is a futuristic ship-shaped building rising from the water.',
  },
  rotterdam: {
    coordinates: { lat: 51.9244, lng: 4.4777 },
    name_en: 'Rotterdam',
    short_en: 'Europe’s largest port, Cube Houses, Erasmus Bridge, Markthal, futuristic central station.',
    full_en: 'Rotterdam is the second-largest city in the Netherlands and a major global port on the Maas river. After German bombing in 1940 destroyed almost the entire city, it embraced architectural innovation rather than rebuilding the past. The port is the largest in Europe and one of the busiest in the world. Its rivers and canals are mostly industrial rather than ornamental, unlike Amsterdam. The futuristic Centraal Station has a metallic arrow-shaped roof pointing toward the centre. The Markthal, opened in 2014, is a giant covered arch full of food stalls and restaurants. The Cube Houses (1970s) are tilted blocks evoking an abstract forest, each cube standing in for a tree. Opened in 1996, the Erasmus Bridge is a modern icon connecting north and south Rotterdam.',
  },
  gaaga: {
    coordinates: { lat: 52.0705, lng: 4.3007 },
    name_en: 'The Hague',
    short_en: '“City of peace and justice”: Peace Palace, Binnenhof, Kijkduin and Scheveningen beaches.',
    full_en: 'The third-largest city in the Netherlands, The Hague is the country’s seat of government. It is known worldwide as the “city of peace and justice,” home to the International Court of Justice and the International Criminal Court. In the Golden Age it became a centre of diplomacy and aristocracy, distinct from Amsterdam’s commercial character. The Peace Palace, partly funded by philanthropist Andrew Carnegie, houses the ICJ and is a global symbol of peace. The Binnenhof, the historic heart of Dutch politics, hosts parliament, the cabinet and the prime minister’s office. The Hague is the only major Dutch city with direct access to the North Sea: family-friendly Kijkduin and the broad, lively Scheveningen beach draw hundreds of thousands of visitors each summer.',
  },
  utreht: {
    coordinates: { lat: 52.0907, lng: 5.1214 },
    name_en: 'Utrecht',
    short_en: 'Two-level canals, Union of Utrecht (1579), King’s Day.',
    full_en: 'Utrecht is the country’s fourth-largest city. The Union of Utrecht, signed here in 1579, created the Republic of the Seven United Provinces — predecessor of today’s Netherlands. Its canals are unique for their two levels: street level above and a wharf level at the water where medieval warehouses once stood. Every 27 April the city celebrates King’s Day; people dress in orange and the canals fill with festive boats. As the canal districts deindustrialised in the 19th and 20th centuries, many warehouse spaces were converted into houseboat homes.',
  },
  eyndhoven: {
    coordinates: { lat: 51.4416, lng: 5.4697 },
    name_en: 'Eindhoven',
    short_en: '“City of Light”, Philips headquarters since 1891.',
    full_en: 'Eindhoven is known as the “City of Light” because Philips set up its headquarters and lightbulb factories here, transforming a small walled settlement at the meeting of the Dommel and Gender rivers into a major industrial centre. A new era began in 1891 when brothers Gerard and Anton Philips opened a lightbulb factory that grew into a global electronics powerhouse. Today the city is also one of Europe’s leading hubs for advanced technology research.',
  },
  maastriht: {
    coordinates: { lat: 50.8514, lng: 5.6909 },
    name_en: 'Maastricht',
    short_en: 'Maastricht Treaty (1992), foundation of the EU and the euro.',
    full_en: 'Maastricht is the capital of Limburg, in the far south of the country near the Belgian and German borders. During French occupation (1794–1814) it absorbed architectural and culinary influences still visible today. The defining moment in its history was the signing of the Maastricht Treaty in 1992, which launched the European Union and the euro. The city has a medieval centre of cobbled streets, brick-and-stone houses, and many Romanesque and Gothic churches.',
  },
  groningen: {
    coordinates: { lat: 53.2194, lng: 6.5665 },
    name_en: 'Groningen',
    short_en: 'University since 1614, the 97-metre Martinitoren tower.',
    full_en: 'Often called the “oldest young city in the Netherlands,” Groningen is a lively university metropolis with medieval roots. The University of Groningen, founded in 1614, is one of the country’s oldest and a major cultural and scientific centre. The Martinitoren — known as the Old Tower — rises 97 metres (318 ft) and is the tallest structure in the northern Netherlands.',
  },
  neymegen: {
    coordinates: { lat: 51.8126, lng: 5.8372 },
    name_en: 'Nijmegen',
    short_en: 'One of the oldest Dutch cities, with Roman roots.',
    full_en: 'On the Waal river, Nijmegen has two thousand years of history with Roman roots, making it one of the oldest cities in the Netherlands. During WWII it was the first Dutch city to be liberated, though it suffered heavily from bombing and fighting. Its proximity to Germany has shaped its cultural and historical identity through centuries of exchange, conflict and cooperation.',
  },
  leyden: {
    coordinates: { lat: 52.1601, lng: 4.4970 },
    name_en: 'Leiden',
    short_en: '“City of Science”, the oldest university in the Netherlands (1575).',
    full_en: 'Between Amsterdam and The Hague, Leiden is known as the “City of Science,” birthplace and workplace of great scholars and artists. The country’s oldest university, founded in 1575, has hosted figures from Descartes and Einstein to several Nobel laureates. The medieval canals were dug for defence and transport and expanded in the Golden Age. In 1574 the city heroically resisted a Spanish siege during the Eighty Years’ War — a defining moment for Dutch independence.',
  },
  delft: {
    coordinates: { lat: 52.0116, lng: 4.3571 },
    name_en: 'Delft',
    short_en: 'Blue-and-white pottery, William of Orange’s tomb.',
    full_en: 'Between Rotterdam and The Hague, Delft is famous for its blue-and-white pottery and is closely tied to the Dutch monarchy: William of Orange, founder of the nation, was assassinated here and is buried in the Nieuwe Kerk. The first canal was dug in the Middle Ages to drain marshland, after which the city expanded. Delftware became Europe’s answer to prized Chinese porcelain and turned into a Dutch cultural symbol.',
  },
  harlem: {
    coordinates: { lat: 52.3874, lng: 4.6462 },
    name_en: 'Haarlem',
    short_en: '“City of flowers”, De Adriaan windmill, Müller organ, St Bavo Cathedral.',
    full_en: 'Capital of North Holland, Haarlem is known as the “city of flowers” for its central role in the Golden Age tulip industry. Today it is a cultural and residential city famed for its quality of life and proximity to Amsterdam and the coast. During the Eighty Years’ War it famously held out against the Spanish for seven months. One landmark is the De Adriaan windmill, built atop an old defensive tower. The Grote Kerk, originally Catholic, became Reformed after the 16th-century Reformation; inside is the Müller organ, played by Handel, Mendelssohn and Mozart. To the south rises St Bavo Cathedral, mixing neo-Gothic, neo-Romanesque and Byzantine styles.',
  },
  gauda: {
    coordinates: { lat: 52.0115, lng: 4.7105 },
    name_en: 'Gouda',
    short_en: 'Cheese, Gothic city hall (1448–1450), St John’s Church.',
    full_en: 'Between Rotterdam and Utrecht, Gouda is famous for its cheese as well as its medieval heritage and centuries of craft. In the Middle Ages it was a major trade centre for beer, candles, pottery and especially cheese. The weekly cheese market on the main square (April–August) is the place to buy Gouda. Its waterways carried peat, beer and cheese. The 1448–1450 city hall is a jewel of Dutch medieval architecture. St John’s Church is the longest church in the country and a national Protestant treasure, while St Joseph’s, a neo-Gothic Catholic church, symbolises the 19th-century revival of Dutch Catholicism.',
  },
  zvolle: {
    coordinates: { lat: 52.5168, lng: 6.0830 },
    name_en: 'Zwolle',
    short_en: 'Star-shaped canals, the “pepper-mill” tower.',
    full_en: 'The capital of Overijssel, in the eastern Netherlands, has a historic centre encircled by a star-shaped ring of canals enclosing medieval houses and monuments. At its peak Zwolle was wealthy enough to rival Amsterdam in trade — its hallmark goods were salted herring and beer for export. The tower of the Basilica of Our Lady, nicknamed the “pepper-mill” for its shape, is the city’s landmark.',
  },
  alkmar: {
    coordinates: { lat: 52.6324, lng: 4.7534 },
    name_en: 'Alkmaar',
    short_en: 'Historic cheese market with porters in their guilds.',
    full_en: 'Between Amsterdam and the North Sea, Alkmaar is famous for its historic cheese market and the motto “Where Holland’s victory begins.” The city was decisive in the Eighty Years’ War: in 1573 it withstood a Spanish siege, the rebels’ first major victory. The Waag square turns into a lively scene where Gouda and Edam wheels are displayed and sold. Porters in traditional dress carry the wheels on stretchers to be weighed; the colour of their hats marks their guild, a system that has persisted for centuries.',
  },
  'den-bosh': {
    coordinates: { lat: 51.6978, lng: 5.3037 },
    name_en: '’s-Hertogenbosch (Den Bosch)',
    short_en: 'Gothic Cathedral of St John.',
    full_en: 'Capital of North Brabant, Den Bosch is one of the country’s best-preserved medieval cities. During the Eighty Years’ War it was a Catholic stronghold loyal to Spain; it was besieged and taken in 1629 by Frederick Henry of Orange. In the 14th and 15th centuries the city flourished, and construction began on the Cathedral of St John — one of Europe’s great Gothic churches.',
  },
  horn: {
    coordinates: { lat: 52.6425, lng: 5.0597 },
    name_en: 'Hoorn',
    short_en: 'Golden Age port, base of the Dutch East and West India Companies.',
    full_en: 'Hoorn was one of the foremost Dutch ports in the Golden Age, known for its sailors, merchants and explorers. It served as a base for both the Dutch East India and West India Companies, a naval and commercial hub. Its historic centre is full of 17th-century merchant houses, similar in style to Amsterdam’s but smaller. Nearby runs the Hoorn–Medemblik steam railway, a heritage line revived for tourism after the original closed.',
  },
  amersfort: {
    coordinates: { lat: 52.1561, lng: 5.3878 },
    name_en: 'Amersfoort',
    short_en: '“Heart of Holland”, the Tower of Our Lady, Koppelpoort gate.',
    full_en: 'Halfway between Amsterdam and Arnhem, Amersfoort is celebrated for its quality of life. Its central location earns it the nickname “heart of Holland.” It is at once medieval — with surviving walls, towers and canals — and modern, with a rich cultural life. In the Middle Ages it was a pilgrimage centre devoted to “Our Lady of Amersfoort.” The Tower of Our Lady, the city’s tallest, once belonged to a church demolished in 1787 and now stands alone. The Koppelpoort, allowing passage by both land and water, is a unique European fortified gate.',
  },
  kampen: {
    coordinates: { lat: 52.5552, lng: 5.9111 },
    name_en: 'Kampen',
    short_en: 'Hanseatic League member, medieval city gates.',
    full_en: 'On the IJssel river, this medieval city was one of the most powerful members of the Hanseatic League — the Baltic trading alliance. Today Kampen retains an exceptional architectural heritage and the atmosphere of a merchant town. The medieval street plan is intact, and several city gates still stand at its entrances.',
  },
  dordreht: {
    coordinates: { lat: 51.8133, lng: 4.6901 },
    name_en: 'Dordrecht',
    short_en: 'Cradle of Dutch independence (1572).',
    full_en: 'In the south-west of the country, Dordrecht sits on an island formed by the Oude Maas, Beneden-Merwede and Noord rivers. A catastrophic 1421 storm destroyed many surrounding villages; Dordrecht survived but was cut off, becoming an island. In 1572 several provinces met here in support of William of Orange, earning the city the title of cradle of Dutch independence.',
  },
  almere: {
    coordinates: { lat: 52.3508, lng: 5.2647 },
    name_en: 'Almere',
    short_en: 'Modern city on land reclaimed from the sea, founded in 1976.',
    full_en: 'East of Amsterdam in Flevoland, Almere stands on land that only decades ago was part of the Zuiderzee. After the Afsluitdijk closed off the bay in 1932, the marshes were drained and the city was founded in 1976 as a suburb to relieve Amsterdam’s population pressure. Its centre mixes residential blocks, shopping zones, plazas and artificial canals; modern brick-and-glass houses, many with water access or green surroundings, dominate the neighbourhoods.',
  },

  // ── Исторические/портовые ──
  elburg: {
    coordinates: { lat: 52.4456, lng: 5.8403 },
    name_en: 'Elburg',
    short_en: 'Medieval rectangular plan (1392–1396), Vischpoort gate.',
    full_en: 'Elburg has remarkably preserved its medieval layout. Between 1392 and 1396, under Count William I of Guelders, it was rebuilt entirely on a rectangular grid — pioneering for its time. Its walls are almost intact, as is the famed Vischpoort, one of the historic gates that once gave access to the harbour.',
  },
  zaltbommel: {
    coordinates: { lat: 51.8089, lng: 5.2517 },
    name_en: 'Zaltbommel',
    short_en: 'Hanseatic town on the Waal, Loevestein Castle nearby.',
    full_en: 'In Gelderland, on the Waal — one of the main branches of the Rhine — Zaltbommel flourished as a Hanseatic town in the Middle Ages, trading actively in salt, grain, wine and other goods. Nearby stands Loevestein Castle, at the confluence of the Waal and Maas, which served as a medieval fortress, later a prison, and today a museum.',
  },
  naarden: {
    coordinates: { lat: 52.2967, lng: 5.1592 },
    name_en: 'Naarden',
    short_en: 'Renaissance star-shaped fortress.',
    full_en: 'In North Holland, Naarden has preserved a Renaissance star-shaped fortress. From above it appears as a perfect geometric design, an icon of military architecture. Few European cities can boast such a complete defensive system with double moats and double walls. Destroyed in 1572 by Spanish troops during the Eighty Years’ War, it was rebuilt in the 17th century as an Italian-style fortress.',
  },
  brille: {
    coordinates: { lat: 51.9050, lng: 4.1684 },
    name_en: 'Brielle',
    short_en: 'First city liberated from the Spanish.',
    full_en: 'A small fortified town in South Holland, Brielle is famed in Dutch history as the first city freed from Spanish rule during the Eighty Years’ War. After independence it became a model fortified town with star-shaped walls and Italian-style bastions. Today it feels like an open-air museum: much of the historic centre seems frozen in time, with 17th-century houses and cobbled streets.',
  },
  burtanzh: {
    coordinates: { lat: 53.0066, lng: 7.1894 },
    name_en: 'Bourtange',
    short_en: 'Fortress town from 1593, an open-air museum.',
    full_en: 'A rare example of Renaissance military architecture, this small fortress town was built in 1593 during the Eighty Years’ War to control the only passable road between Germany and the city of Groningen. Today it is an open-air museum where visitors can experience life inside an early-modern Dutch fortress.',
  },
  dokkum: {
    coordinates: { lat: 53.3287, lng: 5.9978 },
    name_en: 'Dokkum',
    short_en: 'Star-shaped canals, site of the murder of St Boniface in 754.',
    full_en: 'Dokkum stands out for its fortified heritage and exceptional state of preservation. The missionary St Boniface was killed here in 754, turning Dokkum into a Christian pilgrimage centre. Its historic core is ringed by star-shaped canals lined with old merchant houses, ancient churches and traditional windmills. These canals once formed part of the defensive system and were also vital trade routes; today they shelter pleasure craft.',
  },
  zirikzee: {
    coordinates: { lat: 51.6500, lng: 3.9167 },
    name_en: 'Zierikzee',
    short_en: 'Hanseatic League member, the “Dikke Toren”.',
    full_en: 'With just over eleven thousand residents, Zierikzee stands out for its rich medieval past, historic harbour and well-preserved monuments. In the 14th century it was a member of the Hanseatic League, giving it economic clout and trade ties with northern Europe. Its 17th-century port flourished on fishing, shipping and trade. The “Dikke Toren” was meant to be part of a massive cathedral, but the project was never finished; today visitors can climb it for views over the island.',
  },
  'veyk-bay-dyurstede': {
    coordinates: { lat: 51.9744, lng: 5.3414 },
    name_en: 'Wijk bij Duurstede',
    short_en: 'Rijn en Lek windmill, Duurstede Castle.',
    full_en: 'In this small town the relaxed pace of a riverside community meets a past of strategic importance. In the Middle Ages Wijk bij Duurstede thrived as a trade centre thanks to its Rhine harbour. The Rijn en Lek windmill was built on the site of medieval city gates and served as both defence and grain mill. The historic centre also holds Duurstede Castle, surrounded by a moat and a leafy park.',
  },
  makkum: {
    coordinates: { lat: 53.0500, lng: 5.4000 },
    name_en: 'Makkum',
    short_en: '“Gateway to the Zuiderzee”, traditional pottery, beach.',
    full_en: 'Known as the “Gateway to the Zuiderzee,” Makkum has been a centre of trade, shipping and crafts for centuries. Its position on the IJsselmeer made it strategically valuable as a port and now turns it into a major tourist draw. It is one of the few places where traditional Dutch pottery is still made using techniques dating back to the 17th century. Just outside the village, Makkum Beach is popular for camping and water sports.',
  },
  harlingen: {
    coordinates: { lat: 53.1742, lng: 5.4250 },
    name_en: 'Harlingen',
    short_en: 'One of 11 Frisian cities, ferries to Terschelling and Vlieland.',
    full_en: 'One of the eleven historic cities of Friesland, Harlingen sits on the Wadden Sea coast. It thrived in the Dutch Golden Age on maritime trade, herring fishing and shipbuilding. Beyond being a port, it has a network of canals that once linked warehouses and the harbour with Friesland’s inland waterways. Ferries leave from here for the islands of Terschelling and Vlieland; the town remains a key fishing and water-recreation hub.',
  },
  snek: {
    coordinates: { lat: 53.0333, lng: 5.6594 },
    name_en: 'Sneek',
    short_en: '“City of water”, Sneek Week.',
    full_en: 'In Friesland, Sneek is known as the “city of water” for its close ties to canals, lakes and water transport. In the 20th and 21st centuries it became Friesland’s cultural capital, closely linked to the main annual sailing event — Sneek Week. East of the town lies Lake Sneek, part of the Frisian lake system connected by navigable canals; its central island, Starteiland, becomes the heart of Sneek Week each summer — Europe’s largest inland-water sailing regatta.',
  },
  hindlopen: {
    coordinates: { lat: 52.9333, lng: 5.4000 },
    name_en: 'Hindeloopen',
    short_en: 'Frisian town of ~800 inhabitants.',
    full_en: 'Another of the eleven Frisian cities, Hindeloopen is famous for its maritime culture, traditional painting style and vivid folk costumes. With about 800 inhabitants it is one of the smallest officially chartered towns in the world. In the Golden Age it peaked as a maritime centre, and its sailors brought back cultural and artistic influences from across Europe.',
  },
  iylst: {
    coordinates: { lat: 52.9833, lng: 5.6167 },
    name_en: 'IJlst',
    short_en: 'Frisian village with tree-lined canals.',
    full_en: 'Small in population and peaceful in mood, IJlst is known for its tree-lined canals, skating traditions and strong Frisian identity. In the early modern period it specialised in building small and mid-sized boats, prized for fishing and local trade. Trees line the main canals, and residents grow flowers and vegetables in front of their houses.',
  },
  lemmer: {
    coordinates: { lat: 52.8458, lng: 5.7172 },
    name_en: 'Lemmer',
    short_en: 'Nearby is the Woudagemaal steam pumping station (1920).',
    full_en: 'On the IJsselmeer and linked to the Frisian lakes, Lemmer is a main gateway to the region’s waterways. For centuries it thrived on fishing, shipping and the peat trade and saw its share of military conflict. Just outside the town, the Woudagemaal — a steam pumping station built in 1920 — is the largest still in operation of its kind. A residential complex along the lakeside is built over the water with houses arranged in a circular geometric plan and connected by canals.',
  },
  medemblik: {
    coordinates: { lat: 52.7720, lng: 5.1058 },
    name_en: 'Medemblik',
    short_en: 'Historic gem on the IJsselmeer.',
    full_en: 'On the shore of the IJsselmeer, Medemblik is a historic gem where medieval traces meet a lively harbour. In the Middle Ages it was a fishermen’s and merchants’ settlement; later it became a touristy town with a marina, museums and sailing options. With fewer than ten thousand residents, it played a key political and defensive role in the medieval Netherlands.',
  },
  deventer: {
    coordinates: { lat: 52.2660, lng: 6.1552 },
    name_en: 'Deventer',
    short_en: 'Medieval fairs, centre of grain and salt trade.',
    full_en: 'On the IJssel river, Deventer is famous for its renowned medieval fairs and markets, which still draw visitors from across the country. In the 14th and 15th centuries it became a hub of grain, wine, textile and salt trade as well as an intellectual and religious centre.',
  },
  heysden: {
    coordinates: { lat: 51.7283, lng: 5.1394 },
    name_en: 'Heusden',
    short_en: 'Star-shaped fortifications, exemplary restoration.',
    full_en: 'On the Maas river, Heusden stands out for its star-shaped fortifications and its historic centre filled with restored houses. In the 16th and 17th centuries, during the wars against Spain, it was fortified as a star fort with bastions, moats and brick-and-clay walls. A meticulous mid-20th-century restoration based on the original plans returned Heusden to its 17th-century look and made it a pioneering example in Europe.',
  },
  zyutfen: {
    coordinates: { lat: 52.1383, lng: 6.1944 },
    name_en: 'Zutphen',
    short_en: '“City of towers”, the Walburgiskerk.',
    full_en: 'In Gelderland, Zutphen has preserved a historic centre full of towers, churches and old houses. With over 1,700 years of history, it is called the “city of towers” for its many medieval towers and belfries. Its main church, the Walburgiskerk, was tied to the power of the counts of Zutphen and later to the Bishopric of Utrecht.',
  },
  'den-helder': {
    coordinates: { lat: 52.9595, lng: 4.7595 },
    name_en: 'Den Helder',
    short_en: '“Gate to the Wadden Sea”, Royal Navy base, Lange Jaap lighthouse.',
    full_en: 'Known as the “gate to the Wadden Sea,” Den Helder has always been strategically important to the Dutch navy. It is the main base of the Royal Netherlands Navy, with shipyards and military academies. The Lange Jaap lighthouse, built in 1877–1878, made the dangerous North Sea waters safer to navigate. Just nearby, Julianadorp is a beach resort known for its coastal bungalows and campsites.',
  },
  iymuyden: {
    coordinates: { lat: 52.4628, lng: 4.6076 },
    name_en: 'IJmuiden',
    short_en: 'Amsterdam’s port gate, IJmuiden aan Zee beach.',
    full_en: 'A major port city on the North Sea Canal, IJmuiden is Amsterdam’s gateway to the sea — every large vessel bound for the capital passes here. The town came into being in 1876 with the canal that gave Amsterdam direct sea access. Nearby IJmuiden aan Zee is a wide beach popular for surfing, kitesurfing and windsurfing.',
  },
  vesp: {
    coordinates: { lat: 52.3081, lng: 5.0408 },
    name_en: 'Weesp',
    short_en: 'Birthplace of Van Houten chocolate, elevated canals.',
    full_en: 'Weesp combines the charm of a fortified town with the calm of a riverside settlement. Its medieval defences were part of a system that used dikes and controlled floods as military barriers. From the 18th century onward the town industrialised, with chocolate and porcelain factories — Van Houten chocolate was born here. Near Weesp, elevated canals let boats pass over roads while cars drive underneath.',
  },
  virlingsbek: {
    coordinates: { lat: 51.6122, lng: 6.0244 },
    name_en: 'Vierlingsbeek',
    short_en: 'Rural area on the Maas.',
    full_en: 'Along the Maas, this rural area reflects a mix of farming life, strategic significance and the scars of European conflict. After being destroyed in WWII it was almost entirely rebuilt, though some historic buildings remain. It has modernised since but stays rooted in agriculture and livestock farming, with a strong community spirit, local traditions and festivals.',
  },
  heyzen: {
    coordinates: { lat: 52.3000, lng: 5.2400 },
    name_en: 'Huizen',
    short_en: 'Fishing houses on the Gooimeer.',
    full_en: 'In North Holland on the Gooimeer, east of Amsterdam, Huizen takes its name — literally “houses” in Dutch — from the early stone settlements built here. The historic centre preserves traditional fishing houses of brick and wood lining narrow streets.',
  },

  // ── Деревни ──
  gitorn: {
    coordinates: { lat: 52.7400, lng: 6.0789 },
    name_en: 'Giethoorn',
    short_en: '“Dutch Venice”, a village without streets — only canals.',
    full_en: 'In Overijssel, Giethoorn is a charming village nicknamed the “Dutch Venice.” It was founded in the 13th century by farmers and monks who dug peat — the pre-coal fuel — creating the lakes and canals that define the place. There are no roads for cars; canals, footpaths and dozens of bridges connect houses and gardens. Each home is surrounded by canals and tidy gardens linked by little wooden bridges. Some sit on small private islands, each with its own jetty.',
  },
  'zaanse-shans': {
    coordinates: { lat: 52.4742, lng: 4.8169 },
    name_en: 'Zaanse Schans',
    short_en: 'Open-air museum: windmills, 17th–18th-century houses.',
    full_en: 'Zaanse Schans brings the Dutch Golden Age to life from a time when this region became one of the world’s first industrial centres. Set up in the 1960s to preserve windmills and historic 17th–18th-century houses, it gathers what was once a working landscape: hundreds of mills here produced oil, flour, cocoa, wood and even ships. Each mill specialised — from grinding pigments and spices to making paper and shipyard timber.',
  },
  zaandam: {
    coordinates: { lat: 52.4389, lng: 4.8178 },
    name_en: 'Zaandam',
    short_en: 'Heart of the Zaanstreek, Inntel Hotel.',
    full_en: 'Zaandam is the heart of the Zaanstreek, one of the oldest industrial regions in the world. In the 17th century the Zaan area had over 600 windmills working at once and is considered the world’s first industrial zone. The dark-green wooden houses were typical homes for merchants, sailors and mill workers. In recent reconstructions, architects have reinterpreted these traditional green houses into large modern buildings — most famously the Inntel Hotel, whose facade looks like a stack of iconic local houses.',
  },
  shermerhorn: {
    coordinates: { lat: 52.5489, lng: 4.8961 },
    name_en: 'Schermerhorn',
    short_en: 'A village of farmers and millers.',
    full_en: 'This small village has a deep connection to Dutch water management: with dozens of windmills, the lake of Schermer was drained and turned into a vast reclaimed area. After the drainage Schermerhorn became a village of farmers and millers, surrounded by fertile fields. There were originally over 50 windmills here; some survive today as museums and monuments.',
  },
  shtompetoren: {
    coordinates: { lat: 52.5667, lng: 4.8833 },
    name_en: 'Stompetoren',
    short_en: '“Stumpy tower”.',
    full_en: 'Now a quiet settlement, Stompetoren has great historical value through its connection to the Dutch struggle with water. Like Schermerhorn, it emerged in the 17th century after the draining of Lake Schermer. The drained land became fertile farmland, and Stompetoren grew as an agricultural village. Its name literally means “stumpy tower,” after the village’s Reformed church whose tower lacks a pointed spire.',
  },
  durgerdam: {
    coordinates: { lat: 52.3789, lng: 4.9728 },
    name_en: 'Durgerdam',
    short_en: 'Village on the Waterland dike.',
    full_en: 'A small village north-east of Amsterdam on the IJmeer shore, Durgerdam’s wooden houses line the Waterland dike, built in the Middle Ages to protect the Waterland region. After the Afsluitdijk was completed in 1932 fishing declined, and the village turned into a peaceful residential community. In winter the IJmeer often freezes, allowing ice-skating across the lake.',
  },
  reuveyk: {
    coordinates: { lat: 52.0500, lng: 4.7167 },
    name_en: 'Reeuwijk',
    short_en: 'A network of rectangular peat-extraction lakes.',
    full_en: 'This small town is defined by a network of narrow rectangular lakes lying nearly parallel between meadows and dikes. They formed through peat extraction in the Middle Ages: the dug trenches filled with water over time, creating this distinctive landscape. East of Reeuwijk lies the Oukoop polder, which depends on a pumping system to stay dry. Unlike Reeuwijk, where the land was flooded, Oukoop kept its meadows and farmland through constant drainage. The Sluipwijk polder also lies here and preserves a medieval geometric pattern of straight ditches dividing parcels.',
  },
  kinderdeyk: {
    coordinates: { lat: 51.8833, lng: 4.6333 },
    name_en: 'Kinderdijk',
    short_en: '18th-century windmill complex (UNESCO).',
    full_en: 'In South Holland, Kinderdijk combines historic windmills with hydraulic engineering. Built in the 18th century to pump water and protect the area from frequent floods, today its canals, sluices and dikes still function as part of the water-management system. The windmills worked as a single system, lifting water step by step until it reached the river Lek.',
  },
  volendam: {
    coordinates: { lat: 52.4944, lng: 5.0742 },
    name_en: 'Volendam',
    short_en: '14th-century fishing village.',
    full_en: 'This North Holland fishing village stands on the IJsselmeer near Amsterdam. It arose in the 14th century when residents of a neighbouring town built a new harbour and dammed the old one. For centuries Volendam stayed isolated, helping preserve its dialect and traditions. By the 19th century it had become popular with painters and artists; today it is a major tourist destination.',
  },
  'poluostrov-marken': {
    coordinates: { lat: 52.4567, lng: 5.1056 },
    name_en: 'Marken Peninsula',
    short_en: 'Former island, joined to the mainland by a causeway in 1957.',
    full_en: 'A small peninsula in the IJsselmeer near Amsterdam and Volendam. For centuries it was an isolated island in the Zuiderzee where residents lived a quiet life dependent on fishing. In 1957 a causeway linked it to the mainland, turning it into a peninsula and making it more accessible. Tourism is now a key part of the local economy, yet residents still preserve their distinctive identity and peaceful way of life.',
  },
  urk: {
    coordinates: { lat: 52.6628, lng: 5.6017 },
    name_en: 'Urk',
    short_en: 'Former island amid reclaimed land, 1844 lighthouse.',
    full_en: 'Once an island in the former Zuiderzee, Urk now stands amid reclaimed land. Despite the changes, residents have kept a strong island identity reflected in their dialect, traditional dress and maritime culture. The old town is a maze of narrow alleys, brick houses and gabled roofs, many painted in bright colours. The 1844 Urk lighthouse remains a village symbol and once played a key role in guiding ships.',
  },
  'loenen-an-de-veht': {
    coordinates: { lat: 52.2056, lng: 5.0250 },
    name_en: 'Loenen aan de Vecht',
    short_en: 'Village with riverside estates on the Vecht.',
    full_en: 'Along the Vecht river, Loenen aan de Vecht boasts elegant riverside estates. Its history goes back to the Middle Ages, when it grew as a farming and fishing settlement. In the Golden Age wealthy Amsterdam merchants built lavish country estates here, and in the 17th century it became a retreat for the elite.',
  },
  blauvestad: {
    coordinates: { lat: 53.1828, lng: 6.9594 },
    name_en: 'Blauwestad',
    short_en: 'Founded in 2005, lakeside houses with private jetties.',
    full_en: 'Unlike many historic Dutch towns, Blauwestad was officially founded in 2005, making it one of the country’s youngest. It was created by flooding former farmland and combines modern housing with infrastructure for boats and water sports. Houses are built right on the lakeshore, each with its own jetty and direct water access.',
  },
  dronten: {
    coordinates: { lat: 52.5250, lng: 5.7167 },
    name_en: 'Dronten',
    short_en: 'Flevoland village founded in the 20th century.',
    full_en: 'A village in Flevoland, founded in the 20th century as part of land reclamation. Before the Afsluitdijk this area belonged to the flood-prone Zuiderzee, which made the large-scale draining possible. The first houses went up in 1962, and the town has grown steadily ever since, with strong ties to Amsterdam, Zwolle and other nearby cities.',
  },

  // ── Гидротехника ──
  afsleytdeyk: {
    coordinates: { lat: 53.0667, lng: 5.0333 },
    name_en: 'Afsluitdijk',
    short_en: 'Massive dike (1927–1932), sealed off the Zuiderzee.',
    full_en: 'This massive dike closes off the inland sea of the Zuiderzee and turns it into Lake IJsselmeer, protecting the country from flooding and creating new land. It is regarded as one of the largest and most ambitious water-management projects in the world. Construction ran from 1927 to 1932 and required millions of cubic metres of sand, clay and stone, and the labour of thousands of workers. At its eastern end, monumental locks let vessels cross between fresh and salt water.',
  },
  'akveduk-velyuvemeer': {
    coordinates: { lat: 52.4106, lng: 5.6294 },
    name_en: 'Veluwemeer Aqueduct',
    short_en: 'Boats sail over the N302 motorway (2002).',
    full_en: 'Opened in 2002 as part of the N302 motorway connecting the Dutch mainland with Flevoland. Drawbridges and tunnels were considered, but a shallow aqueduct was chosen as the most efficient and cost-effective solution. It lets the waters of Lake Veluwe flow over the road, creating a navigable channel for sailboats and small craft.',
  },
  'plotina-ostersheldekering': {
    coordinates: { lat: 51.6300, lng: 3.6800 },
    name_en: 'Oosterscheldekering',
    short_en: 'One of the seven engineering wonders, 65 piers of 18,000 tonnes each.',
    full_en: 'The largest hydraulic project in the Netherlands and one of the seven wonders of modern engineering. This colossal storm-surge barrier is made of 65 concrete piers and giant gates that open and close to control sea level. The scale is staggering — each pier weighs 18,000 tonnes and was placed in the sea with extraordinary precision. The gates, normally open, let the tides flow freely; they close only during storms or flood risk.',
  },
  haringvlietdam: {
    coordinates: { lat: 51.8333, lng: 4.0333 },
    name_en: 'Haringvlietdam',
    short_en: '17 gates between the North Sea and the estuary (1971).',
    full_en: 'One of the country’s largest hydraulic structures. Opened in 1971, it consists of 17 giant gates regulating the flow between the North Sea and the Haringvliet estuary. It plays a crucial role in flood defence and ecological management, helping preserve estuarine biodiversity. It is not just a dam: it also functions as a bridge and road, connecting previously divided regions and improving transport links.',
  },
  brouversdam: {
    coordinates: { lat: 51.7642, lng: 3.8833 },
    name_en: 'Brouwersdam',
    short_en: 'Built after the 1953 flood; turned the Grevelingenmeer into Europe’s largest saltwater lake.',
    full_en: 'Another of the great Dutch dams, built after the catastrophic flood of 1953. Completed in 1971, it is more than just a dam — a multi-purpose structure combining sea defence, transport, energy generation, natural habitat and recreation. It turned the Grevelingenmeer into the largest saltwater lake in western Europe, creating a haven for birds and marine life. Today it is an international destination for surfers, kitesurfers, divers and sailors.',
  },
  'shlyuzy-krammer': {
    coordinates: { lat: 51.6622, lng: 4.1844 },
    name_en: 'Krammer Locks',
    short_en: 'Pass vessels around the clock.',
    full_en: 'The Krammer Locks let vessels through and balance flood protection with shipping. They can operate non-stop and handle hundreds of craft a day, from sailing yachts to large cargo ships.',
  },
  'zelandskiy-most': {
    coordinates: { lat: 51.6500, lng: 3.7500 },
    name_en: 'Zeelandbrug',
    short_en: 'Opened 1965, once the longest bridge in Europe.',
    full_en: 'Opened in 1965, the Zeelandbrug links the islands of Schouwen-Duiveland and Noord-Beveland and was once the longest bridge in Europe.',
  },

  // ── Ветроэлектростанции ──
  'ves-nordostpolder': {
    coordinates: { lat: 52.7500, lng: 5.7500 },
    name_en: 'Noordoostpolder Wind Farm',
    short_en: 'On reclaimed land, ~400,000 homes powered.',
    full_en: 'This wind farm in Flevoland stands on land reclaimed from the sea. The reclaimed area today forms the largest tract of land ever recovered from the sea, made fertile by the mineral-rich former seabed. The farm combines turbines on land and in the water and produces enough electricity each year to power around 400,000 homes.',
  },
  'vetropark-frislan': {
    coordinates: { lat: 52.9667, lng: 5.3500 },
    name_en: 'Windpark Fryslân',
    short_en: 'World’s largest freshwater wind farm, ~500,000 homes.',
    full_en: 'One of the world’s largest freshwater wind farms, built on the IJsselmeer near the Afsluitdijk. Unlike other offshore farms, it is laid out in a compact pattern to reduce visual impact. Its capacity supplies clean electricity to roughly 500,000 Dutch households.',
  },
  'vetropark-krammer': {
    coordinates: { lat: 51.6622, lng: 4.1944 },
    name_en: 'Windpark Krammer',
    short_en: '2019, Europe’s largest community wind farm.',
    full_en: 'Located on a large lake formed by the Delta Works, this project is an innovative example of sustainable energy. Commissioned in 2019, it became the largest community-owned wind farm in Europe, financed by local residents. It was built on the Krammer dams, integrating hydraulic infrastructure with renewable energy.',
  },

  // ── Природа ──
  bollenstrek: {
    coordinates: { lat: 52.2667, lng: 4.5500 },
    name_en: 'Bollenstreek',
    short_en: '“Bulb region”, tulip fields, the heart of tulip mania.',
    full_en: 'The name means “bulb region” in Dutch. It is a coastal strip in the west between the cities of Haarlem and Leiden. Although tulips arrived from Turkey in the 16th century, it was here in the Bollenstreek that they became a major crop and a national symbol of the Netherlands. In the 17th century tulip cultivation triggered history’s first economic bubble — tulip mania.',
  },
  kekenhof: {
    coordinates: { lat: 52.2697, lng: 4.5469 },
    name_en: 'Keukenhof',
    short_en: 'World’s largest tulip garden.',
    full_en: 'At the heart of the Bollenstreek lies Keukenhof, the world’s largest tulip garden. Each spring the park transforms into a unique natural spectacle of millions of tulips, daffodils, hyacinths and other flowers. Its design changes every year, with new shapes, themes and floral compositions.',
  },
  'ozera-vinkevene-i-loosdreht': {
    coordinates: { lat: 52.2167, lng: 5.0167 },
    name_en: 'Vinkeveense Plassen and Loosdrechtse Plassen',
    short_en: '“Dutch Riviera”, legakkers (peat-strip islands).',
    full_en: 'These lakes form a group of waters and canals in Utrecht province, south-east of Amsterdam near the village of Vinkeveen. You will find a mosaic of blue lakes, narrow canals and long strips of land called legakkers. The land between the channels was used in the Middle Ages for drying peat — a process that produced today’s landscape of long, narrow islands. Some of these islands are private and accessible only by boat. Adjacent are the Loosdrechtse Plassen, one of the busiest water-recreation areas in the Netherlands, often called the “Dutch Riviera.”',
  },
  'nacionalnyy-park-velyuve': {
    coordinates: { lat: 52.1167, lng: 5.7833 },
    name_en: 'Veluwe National Park',
    short_en: '“Dutch Sahara”, deer, grey wolf.',
    full_en: 'In the centre of the country lies the largest national park in the Netherlands, with a landscape of forests, dunes and meadows. It rests on an ancient system of glacial moraines from the Ice Age, giving the area its gentle, rolling character. It is sometimes called the Dutch Sahara for its extensive inland sand dunes — rare in central Europe. Purple heathlands turn the landscape violet at certain times of year, creating an almost surreal atmosphere. The park hosts a large red-deer population that survived here when it disappeared from much of the country. The grey wolf, Europe’s largest predator, has recently returned after a near-century absence due to hunting and habitat loss.',
  },
  'nacionalnyy-park-zyuyd-kennemerland': {
    coordinates: { lat: 52.4167, lng: 4.5833 },
    name_en: 'Zuid-Kennemerland National Park',
    short_en: 'Dunes, European bison.',
    full_en: 'Right next to Amsterdam, this park protects an area of dunes, forests, meadows and lakes. The dunes act as a powerful natural filter, supplying drinking water to Haarlem and Amsterdam. It is home to the European bison, the continent’s largest land mammal, reintroduced through international conservation programmes after near-extinction in the 20th century. You can also see European fallow deer, brought to northern Europe by the Romans and later by medieval nobility, and Konik ponies — a semi-wild Polish breed introduced as part of a landscape-management project. They graze the dunes and meadows, keeping shrubs in check and supporting plant and insect diversity.',
  },
  'nacionalnyy-park-alde-feanen': {
    coordinates: { lat: 53.1000, lng: 5.9500 },
    name_en: 'De Alde Feanen National Park',
    short_en: 'White-tailed eagle, otter.',
    full_en: 'This vast wetland began forming in the Middle Ages when peat extraction created trenches, lakes and canals. After centuries of use, much of the area silted up and was overgrown by vegetation, becoming a refuge for birds and mammals. Floating vegetation islands and reed beds extending into the lakes have appeared over the years. It is one of the few places in the Netherlands where the white-tailed eagle — northern Europe’s largest raptor — nests. The species had been gone from the country for decades and its return marks a key milestone in Dutch bird conservation. Likewise, the European otter went extinct here in the 1980s but reintroduction projects and improved water quality have brought it back.',
  },
  'het-tviske': {
    coordinates: { lat: 52.4500, lng: 4.8500 },
    name_en: 'Het Twiske',
    short_en: 'Nature area north of Amsterdam.',
    full_en: 'This nature area north of Amsterdam combines landscapes, water and recreation. Originally used for peat extraction and farming, it later became a large artificial lake surrounded by meadows and woods. Despite its proximity to a big city it keeps a peaceful rural atmosphere with open fields and classic Dutch views.',
  },
  'ostrov-teksel': {
    coordinates: { lat: 53.0556, lng: 4.7972 },
    name_en: 'Texel',
    short_en: 'Largest of the West Frisian Islands, seals.',
    full_en: 'Located in the Wadden Sea north of the mainland, Texel is the largest of the West Frisian Islands. It features beaches, dunes, forests, agricultural polders and wetlands — an extraordinary diversity of landscapes. In some places quicksand appears: wet sandy ground that loses stability and behaves like water. Texel is part of the Wadden Sea ecosystem, shared with migratory birds and marine mammals. The harbour seal — round-headed and short-snouted — is often seen on the sandbanks; the larger grey seal also uses nearby banks to rest and rear pups. The island has been inhabited for centuries with communities scattered across several villages.',
  },
  'prirodnyy-zapovednik-meyendel': {
    coordinates: { lat: 52.1500, lng: 4.3333 },
    name_en: 'Meijendel Nature Reserve',
    short_en: 'Largest coastal dune area, >250 bird species.',
    full_en: 'The Netherlands’ largest coastal dune area, made up of forests, meadows and wetlands. The dunes are covered with tall grasses, shrubs and scattered woodland. The sandy soil acts as a natural filter and is the main source of drinking water for The Hague and the surrounding region. It is a true bird sanctuary, with more than 250 species recorded. A curious detail: abandoned WWII bunkers can still be found across the area.',
  },
  'dyuny-shorl': {
    coordinates: { lat: 52.7000, lng: 4.6833 },
    name_en: 'Schoorl Dunes',
    short_en: 'The highest dunes in the Netherlands.',
    full_en: 'The highest dunes in the Netherlands and an ideal place for hiking and cycling. They formed thousands of years ago through the joint action of the North Sea and the wind, which piled sand along the coast. In some spots vegetation cannot fully cover the dunes, leaving large white patches of bare silica sand. The Schoorl Dunes are striking not only for their height and views but also for their remarkable biodiversity. The mix of pine and oak forests, dunes and marshes creates a habitat for mammals, birds, reptiles, insects and amphibians.',
  },
  'zatoplennaya-zemlya-saftinge': {
    coordinates: { lat: 51.3500, lng: 4.1833 },
    name_en: 'Drowned Land of Saeftinghe',
    short_en: 'Largest brackish tidal marsh in western Europe.',
    full_en: 'The largest brackish tidal marsh in western Europe, in Zeeland province. In the Middle Ages it was fertile, inhabited and protected by dikes, thriving on agriculture and trade. From the 14th century onward, severe storms and sea floods began taking back the area. In 1584, during the war with Spain, Dutch forces deliberately breached the medieval dikes, permanently flooding villages and fields.',
  },
  'nacionalnyy-park-veluvezum': {
    coordinates: { lat: 52.1500, lng: 5.9000 },
    name_en: 'Veluwezoom National Park',
    short_en: 'The country’s first national park, blooming heather.',
    full_en: 'Veluwezoom became the country’s first national park, declared in 1930 as a symbol of Dutch nature conservation. It is a vast region of sands and hills formed during the Ice Age and later covered with forests and heaths. Each August and September the hills turn into a purple carpet as the heather blooms — a captivating natural spectacle. The heaths stretch over sandy hills offering panoramic views, rare in such a flat country. Among the animals living here is the red fox, a mammal known for its ability to adapt to many habitats.',
  },
  'nacionalnyy-park-oostvaardersplassen': {
    coordinates: { lat: 52.4500, lng: 5.4000 },
    name_en: 'Oostvaardersplassen National Park',
    short_en: 'One of Europe’s most important wetlands.',
    full_en: 'Oostvaardersplassen is one of the most important wetlands in Europe, a refuge for migratory birds and large mammals.',
  },

  // ── Замки ──
  'zamok-de-haar': {
    coordinates: { lat: 52.1308, lng: 4.9858 },
    name_en: 'De Haar Castle',
    short_en: 'Largest castle in the Netherlands, near Utrecht.',
    full_en: 'Right next to Utrecht stands the De Haar castle, the largest castle in the Netherlands. Built by the De Haar family in the 14th century, it was rebuilt in the 19th century and later became a gathering place for European high society.',
  },
  'piramida-austerlic': {
    coordinates: { lat: 52.0833, lng: 5.3333 },
    name_en: 'Pyramid of Austerlitz',
    short_en: 'Napoleonic structure from 1804.',
    full_en: 'Near Utrecht stands the Pyramid of Austerlitz, raised in 1804 by Napoleonic troops and inspired by the Egyptian pyramids.',
  },
  'zamok-binnenhof': {
    coordinates: { lat: 52.0800, lng: 4.3133 },
    name_en: 'Binnenhof',
    short_en: 'Heart of Dutch politics in The Hague.',
    full_en: 'The Binnenhof is the historic heart of Dutch politics, housing parliament, the cabinet and the prime minister’s office.',
  },
  'zamok-levesteyn': {
    coordinates: { lat: 51.8167, lng: 5.0167 },
    name_en: 'Loevestein Castle',
    short_en: 'At the confluence of the Waal and Maas.',
    full_en: 'Loevestein Castle stands at the confluence of the Waal and Maas. It was a medieval fortress, later a prison, and today functions as a museum.',
  },
  'zamok-meyderslot': {
    coordinates: { lat: 52.3328, lng: 5.0731 },
    name_en: 'Muiderslot Castle',
    short_en: 'In Muiden near Amsterdam.',
    full_en: 'Muiderslot Castle, in the town of Muiden near Amsterdam, is surrounded by a moat, towers and medieval walls.',
  },
  'zamok-mersbergen': {
    coordinates: { lat: 52.0667, lng: 5.4333 },
    name_en: 'Moersbergen Castle',
    short_en: 'In Utrecht province, surrounded by woods.',
    full_en: 'Moersbergen Castle in Utrecht province is set among forests and classic Dutch landscapes.',
  },
  'zamok-dorvert': {
    coordinates: { lat: 51.9942, lng: 5.9300 },
    name_en: 'Doorwerth Castle',
    short_en: 'In Gelderland on the Rhine.',
    full_en: 'Doorwerth Castle in Gelderland rises among forests and meadows along the Rhine.',
  },

  // ── Карибы ──
  kyurasao: {
    coordinates: { lat: 12.1696, lng: -68.9900 },
    name_en: 'Curaçao',
    short_en: 'Willemstad, Queen Emma Bridge, Klein Curaçao.',
    full_en: 'This Caribbean island is a constituent country of the Kingdom of the Netherlands. The Dutch West India Company seized it in 1634, turning it into a trade and slave-trade hub. Willemstad, the capital, blends Dutch architecture with African traditions and Jewish, Latin American and Caribbean influences. Legend has it that a governor with migraines forbade painting the houses white to avoid sun glare on the walls. One symbol of the city is the Queen Emma Bridge, a pontoon bridge that swings open to let ships pass. Off the south-east coast lies Klein Curaçao, an uninhabited island with long pristine beaches and a key sea-turtle nesting site.',
  },
  bonayre: {
    coordinates: { lat: 12.1784, lng: -68.2385 },
    name_en: 'Bonaire',
    short_en: 'Kralendijk, flamingos, salt pans.',
    full_en: 'In the Dutch Caribbean north of Venezuela, Bonaire has been a special municipality of the Netherlands since 2010. Captured by the Spanish in 1499 and conquered by the Dutch in 1636, it was used mainly for salt production. Kralendijk, the capital, is a small coastal town full of colourful colonial houses, seaside bars and restaurants. To the south huge salt evaporation ponds tint the landscape pink. The Pekelmeer lagoon at the southern tip is home to one of the largest Caribbean flamingo colonies. Off Kralendijk lies Klein Bonaire, a flat uninhabited island declared a protected area for its coral reefs and untouched beaches.',
  },
  aruba: {
    coordinates: { lat: 12.5211, lng: -69.9683 },
    name_en: 'Aruba',
    short_en: 'Oranjestad, outside the hurricane belt.',
    full_en: 'A constituent country of the Kingdom of the Netherlands since 1986, Aruba has its own government but shares defence and foreign policy with the Kingdom. In 1636 the Dutch West India Company took control, turning it into a place for goat herding and regional trade. Its capital, Oranjestad, mixes Dutch colonial architecture with vivid tropical colours. Sitting outside the hurricane belt, it is a year-round safe destination known for its calm, cheerful atmosphere.',
  },
  'sint-marten': {
    coordinates: { lat: 18.0425, lng: -63.0548 },
    name_en: 'Sint Maarten',
    short_en: 'The Dutch half of the island.',
    full_en: 'Part of the Kingdom of the Netherlands and bordering the northern half (French Saint-Martin). Christopher Columbus sighted it on his second voyage in 1493 and named it “Saint Martin” because it was 11 November, the saint’s feast day. Spaniards, French and Dutch contested it for centuries; the 1648 Treaty of Concordia split it between France and the Netherlands.',
  },
  'sint-estatius': {
    coordinates: { lat: 17.4890, lng: -62.9733 },
    name_en: 'Sint Eustatius',
    short_en: 'Mount Quill volcano, unique corals.',
    full_en: 'Since 2010 Sint Eustatius has been part of the Caribbean Netherlands as a special municipality, alongside Bonaire and Saba. Columbus saw it in 1493 and over the following centuries it changed hands more than twenty times among Spanish, French, English and Dutch. The island is dominated by Mount Quill, a dormant stratovolcano covered in rainforest, with a large summit crater. It is a quiet, lightly populated diving destination, ideal for travellers seeking nature and peace away from mass tourism. Its waters host many coral species — both hard and soft — including some found nowhere else in the Caribbean.',
  },

  // ── Прочие ──
  reytdifaven: {
    coordinates: { lat: 53.2150, lng: 6.5567 },
    name_en: 'Reitdiephaven',
    short_en: 'Residential harbour in Groningen with brightly painted houses.',
    full_en: 'A small residential harbour in Groningen known for its modern houses painted in bright colours.',
  },
  'bruk-in-vaterland': {
    coordinates: { lat: 52.4308, lng: 4.9819 },
    name_en: 'Broek in Waterland',
    short_en: 'Village with pastel wooden houses.',
    full_en: 'A northern village near Amsterdam with pastel-coloured wooden houses and quiet canals surrounded by nature.',
  },
  valkenburg: {
    coordinates: { lat: 50.8650, lng: 5.8311 },
    name_en: 'Valkenburg',
    short_en: 'Hilly town with castle ruins.',
    full_en: 'A small hilly town — rare in the Netherlands — shaped by the ruins of a medieval castle that rises over the landscape.',
  },
  arnem: {
    coordinates: { lat: 51.9851, lng: 5.8987 },
    name_en: 'Arnhem',
    short_en: 'Capital of Gelderland.',
    full_en: 'The capital of Gelderland combines modern architecture with historic buildings and is known for its green surroundings.',
  },
  breda: {
    coordinates: { lat: 51.5719, lng: 4.7683 },
    name_en: 'Breda',
    short_en: 'Cultural centre of North Brabant.',
    full_en: 'In North Brabant, Breda has become a cultural and university centre with a youthful atmosphere.',
  },
  stavoren: {
    coordinates: { lat: 52.8833, lng: 5.3667 },
    name_en: 'Stavoren',
    short_en: 'Frisian port town.',
    full_en: 'A small Frisian port town with just over a thousand residents.',
  },
  burdard: {
    coordinates: { lat: 53.3167, lng: 5.9000 },
    name_en: 'Burdaard',
    short_en: 'Village on the Dokkumer Ee canal.',
    full_en: 'A quiet Frisian village on the Dokkumer Ee canal.',
  },
};
