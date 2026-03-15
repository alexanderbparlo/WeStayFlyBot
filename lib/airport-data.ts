// lib/airport-data.ts
// Shared airport dataset and search utilities.
// Used by both the subscribe page and manage preferences page.

export interface Airport {
  code: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  dist?: number;
}

export const AIRPORTS: Airport[] = [
  // Northeast
  { code:'JFK', name:'John F. Kennedy Intl',              city:'New York',        state:'NY', lat:40.6413, lon:-73.7781 },
  { code:'LGA', name:'LaGuardia Airport',                  city:'New York',        state:'NY', lat:40.7772, lon:-73.8726 },
  { code:'EWR', name:'Newark Liberty Intl',                city:'Newark',          state:'NJ', lat:40.6895, lon:-74.1745 },
  { code:'BOS', name:'Logan Intl',                         city:'Boston',          state:'MA', lat:42.3656, lon:-71.0096 },
  { code:'PHL', name:'Philadelphia Intl',                  city:'Philadelphia',    state:'PA', lat:39.8721, lon:-75.2411 },
  { code:'BWI', name:'Baltimore/Washington Intl',          city:'Baltimore',       state:'MD', lat:39.1754, lon:-76.6682 },
  { code:'DCA', name:'Ronald Reagan Washington National',  city:'Washington',      state:'DC', lat:38.8512, lon:-77.0402 },
  { code:'IAD', name:'Washington Dulles Intl',             city:'Washington',      state:'DC', lat:38.9531, lon:-77.4565 },
  // Southeast
  { code:'ATL', name:'Hartsfield-Jackson Atlanta Intl',   city:'Atlanta',         state:'GA', lat:33.6407, lon:-84.4277 },
  { code:'MIA', name:'Miami Intl',                         city:'Miami',           state:'FL', lat:25.7959, lon:-80.2870 },
  { code:'FLL', name:'Fort Lauderdale-Hollywood Intl',    city:'Fort Lauderdale', state:'FL', lat:26.0726, lon:-80.1527 },
  { code:'MCO', name:'Orlando Intl',                       city:'Orlando',         state:'FL', lat:28.4312, lon:-81.3081 },
  { code:'TPA', name:'Tampa Intl',                         city:'Tampa',           state:'FL', lat:27.9755, lon:-82.5332 },
  { code:'CLT', name:'Charlotte Douglas Intl',             city:'Charlotte',       state:'NC', lat:35.2144, lon:-80.9473 },
  { code:'RDU', name:'Raleigh-Durham Intl',                city:'Raleigh',         state:'NC', lat:35.8776, lon:-78.7875 },
  { code:'BNA', name:'Nashville Intl',                     city:'Nashville',       state:'TN', lat:36.1263, lon:-86.6774 },
  // Midwest
  { code:'ORD', name:"O'Hare Intl",                        city:'Chicago',         state:'IL', lat:41.9742, lon:-87.9073 },
  { code:'MDW', name:'Chicago Midway Intl',                city:'Chicago',         state:'IL', lat:41.7868, lon:-87.7522 },
  { code:'DTW', name:'Detroit Metropolitan',               city:'Detroit',         state:'MI', lat:42.2162, lon:-83.3554 },
  { code:'MSP', name:'Minneapolis-Saint Paul Intl',        city:'Minneapolis',     state:'MN', lat:44.8848, lon:-93.2223 },
  { code:'CLE', name:'Cleveland Hopkins Intl',             city:'Cleveland',       state:'OH', lat:41.4117, lon:-81.8498 },
  { code:'CMH', name:'John Glenn Columbus Intl',           city:'Columbus',        state:'OH', lat:39.9980, lon:-82.8919 },
  { code:'IND', name:'Indianapolis Intl',                  city:'Indianapolis',    state:'IN', lat:39.7173, lon:-86.2944 },
  { code:'MKE', name:'General Mitchell Intl',              city:'Milwaukee',       state:'WI', lat:42.9472, lon:-87.8966 },
  { code:'STL', name:'St. Louis Lambert Intl',             city:'St. Louis',       state:'MO', lat:38.7487, lon:-90.3700 },
  { code:'MCI', name:'Kansas City Intl',                   city:'Kansas City',     state:'MO', lat:39.2976, lon:-94.7139 },
  { code:'OMA', name:'Eppley Airfield',                    city:'Omaha',           state:'NE', lat:41.3032, lon:-95.8940 },
  // Southwest
  { code:'DFW', name:'Dallas/Fort Worth Intl',             city:'Dallas',          state:'TX', lat:32.8998, lon:-97.0403 },
  { code:'DAL', name:'Dallas Love Field',                  city:'Dallas',          state:'TX', lat:32.8471, lon:-96.8518 },
  { code:'IAH', name:'George Bush Intercontinental',       city:'Houston',         state:'TX', lat:29.9902, lon:-95.3368 },
  { code:'HOU', name:'William P. Hobby',                   city:'Houston',         state:'TX', lat:29.6454, lon:-95.2789 },
  { code:'SAT', name:'San Antonio Intl',                   city:'San Antonio',     state:'TX', lat:29.5337, lon:-98.4698 },
  { code:'AUS', name:'Austin-Bergstrom Intl',              city:'Austin',          state:'TX', lat:30.1975, lon:-97.6664 },
  { code:'PHX', name:'Phoenix Sky Harbor Intl',            city:'Phoenix',         state:'AZ', lat:33.4373, lon:-112.0078 },
  { code:'TUS', name:'Tucson Intl',                        city:'Tucson',          state:'AZ', lat:32.1161, lon:-110.9410 },
  { code:'ABQ', name:'Albuquerque Intl Sunport',           city:'Albuquerque',     state:'NM', lat:35.0402, lon:-106.6090 },
  { code:'DEN', name:'Denver Intl',                        city:'Denver',          state:'CO', lat:39.8561, lon:-104.6737 },
  { code:'COS', name:'Colorado Springs Airport',           city:'Colorado Springs',state:'CO', lat:38.8059, lon:-104.7009 },
  { code:'SLC', name:'Salt Lake City Intl',                city:'Salt Lake City',  state:'UT', lat:40.7884, lon:-111.9778 },
  { code:'LAS', name:'Harry Reid Intl',                    city:'Las Vegas',       state:'NV', lat:36.0840, lon:-115.1537 },
  // West Coast
  { code:'LAX', name:'Los Angeles Intl',                   city:'Los Angeles',     state:'CA', lat:33.9425, lon:-118.4081 },
  { code:'BUR', name:'Hollywood Burbank Airport',          city:'Los Angeles',     state:'CA', lat:34.2007, lon:-118.3585 },
  { code:'LGB', name:'Long Beach Airport',                 city:'Los Angeles',     state:'CA', lat:33.8177, lon:-118.1516 },
  { code:'ONT', name:'Ontario Intl',                       city:'Los Angeles',     state:'CA', lat:34.0560, lon:-117.6012 },
  { code:'SNA', name:'John Wayne Airport',                 city:'Orange County',   state:'CA', lat:33.6757, lon:-117.8682 },
  { code:'SFO', name:'San Francisco Intl',                 city:'San Francisco',   state:'CA', lat:37.6213, lon:-122.3790 },
  { code:'OAK', name:'Oakland Intl',                       city:'Oakland',         state:'CA', lat:37.7213, lon:-122.2208 },
  { code:'SJC', name:'San Jose Mineta Intl',               city:'San Jose',        state:'CA', lat:37.3626, lon:-121.9290 },
  { code:'SAN', name:'San Diego Intl',                     city:'San Diego',       state:'CA', lat:32.7338, lon:-117.1933 },
  { code:'SEA', name:'Seattle-Tacoma Intl',                city:'Seattle',         state:'WA', lat:47.4502, lon:-122.3088 },
  { code:'PDX', name:'Portland Intl',                      city:'Portland',        state:'OR', lat:45.5898, lon:-122.5951 },
  // International
  { code:'CUN', name:'Cancún Intl',                        city:'Cancún',          state:'Mexico',      lat:21.0365, lon:-86.8771 },
  { code:'NAS', name:'Lynden Pindling Intl',               city:'Nassau',          state:'Bahamas',     lat:25.0390, lon:-77.4662 },
  { code:'MBJ', name:'Sangster Intl',                      city:'Montego Bay',     state:'Jamaica',     lat:18.5037, lon:-77.9134 },
  { code:'SJU', name:'Luis Muñoz Marín Intl',              city:'San Juan',        state:'Puerto Rico', lat:18.4394, lon:-66.0018 },
  { code:'LHR', name:'Heathrow Airport',                   city:'London',          state:'UK',          lat:51.4700, lon:-0.4543  },
  { code:'CDG', name:'Charles de Gaulle',                  city:'Paris',           state:'France',      lat:49.0097, lon:2.5479   },
  { code:'FCO', name:'Leonardo da Vinci Intl',             city:'Rome',            state:'Italy',       lat:41.8003, lon:12.2389  },
  { code:'BCN', name:'Barcelona El Prat',                  city:'Barcelona',       state:'Spain',       lat:41.2971, lon:2.0785   },
  { code:'AMS', name:'Amsterdam Schiphol',                 city:'Amsterdam',       state:'Netherlands', lat:52.3086, lon:4.7639   },
  { code:'NRT', name:'Narita Intl',                        city:'Tokyo',           state:'Japan',       lat:35.7720, lon:140.3929 },
  { code:'HND', name:'Haneda Airport',                     city:'Tokyo',           state:'Japan',       lat:35.5494, lon:139.7798 },
  { code:'ICN', name:'Incheon Intl',                       city:'Seoul',           state:'South Korea', lat:37.4602, lon:126.4407 },
  { code:'SYD', name:'Sydney Kingsford Smith',             city:'Sydney',          state:'Australia',   lat:-33.9461,lon:151.1772 },
  { code:'GRU', name:'São Paulo/Guarulhos Intl',           city:'São Paulo',       state:'Brazil',      lat:-23.4356,lon:-46.4731 },
  { code:'MEX', name:'Mexico City Intl',                   city:'Mexico City',     state:'Mexico',      lat:19.4363, lon:-99.0721 },
];

export const ROADTRIP_CITIES: string[] = [
  'Asheville, NC', 'Sedona, AZ', 'Nashville, TN', 'Savannah, GA',
  'Santa Fe, NM', 'Mystic, CT', 'Bar Harbor, ME', 'Moab, UT',
  'Carmel-by-the-Sea, CA', 'Door County, WI', 'Gatlinburg, TN',
  'Traverse City, MI', 'Stowe, VT', 'Marfa, TX', 'Charlottesville, VA',
  'Flagstaff, AZ', 'Lake Tahoe, CA/NV', 'Outer Banks, NC',
  'Key West, FL', 'Napa Valley, CA', 'Shenandoah, VA',
  'Cape Cod, MA', 'Bend, OR', 'Jackson Hole, WY', 'Blue Ridge Parkway, VA/NC',
];

export const AIRLINES: string[] = [
  'Any airline', 'American', 'Delta', 'United', 'Southwest', 'JetBlue',
  'Alaska', 'Spirit', 'Frontier', 'Allegiant', 'Hawaiian', 'Sun Country',
];

// City centroid lookup for haversine-based nearby airport search
export const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'new york':       { lat:40.7128,  lon:-74.0060  },
  'chicago':        { lat:41.8781,  lon:-87.6298  },
  'los angeles':    { lat:34.0522,  lon:-118.2437 },
  'miami':          { lat:25.7617,  lon:-80.1918  },
  'dallas':         { lat:32.7767,  lon:-96.7970  },
  'houston':        { lat:29.7604,  lon:-95.3698  },
  'atlanta':        { lat:33.7490,  lon:-84.3880  },
  'seattle':        { lat:47.6062,  lon:-122.3321 },
  'denver':         { lat:39.7392,  lon:-104.9903 },
  'boston':         { lat:42.3601,  lon:-71.0589  },
  'san francisco':  { lat:37.7749,  lon:-122.4194 },
  'phoenix':        { lat:33.4484,  lon:-112.0740 },
  'washington':     { lat:38.9072,  lon:-77.0369  },
  'philadelphia':   { lat:39.9526,  lon:-75.1652  },
  'las vegas':      { lat:36.1699,  lon:-115.1398 },
  'minneapolis':    { lat:44.9778,  lon:-93.2650  },
  'detroit':        { lat:42.3314,  lon:-83.0458  },
  'portland':       { lat:45.5051,  lon:-122.6750 },
  'salt lake city': { lat:40.7608,  lon:-111.8910 },
  'orlando':        { lat:28.5383,  lon:-81.3792  },
  'nashville':      { lat:36.1627,  lon:-86.7816  },
  'charlotte':      { lat:35.2271,  lon:-80.8431  },
  'austin':         { lat:30.2672,  lon:-97.7431  },
  'san diego':      { lat:32.7157,  lon:-117.1611 },
  'tampa':          { lat:27.9506,  lon:-82.4572  },
  'baltimore':      { lat:39.2904,  lon:-76.6122  },
  'kansas city':    { lat:39.0997,  lon:-94.5786  },
  'st. louis':      { lat:38.6270,  lon:-90.1994  },
  'cleveland':      { lat:41.4993,  lon:-81.6944  },
  'columbus':       { lat:39.9612,  lon:-82.9988  },
  'indianapolis':   { lat:39.7684,  lon:-86.1581  },
  'milwaukee':      { lat:43.0389,  lon:-87.9065  },
  'omaha':          { lat:41.2565,  lon:-95.9345  },
  'cancún':         { lat:21.1619,  lon:-86.8515  },
  'cancun':         { lat:21.1619,  lon:-86.8515  },
  'london':         { lat:51.5074,  lon:-0.1278   },
  'paris':          { lat:48.8566,  lon:2.3522    },
  'rome':           { lat:41.9028,  lon:12.4964   },
  'tokyo':          { lat:35.6762,  lon:139.6503  },
  'barcelona':      { lat:41.3851,  lon:2.1734    },
  'amsterdam':      { lat:52.3676,  lon:4.9041    },
  'sydney':         { lat:-33.8688, lon:151.2093  },
  'seoul':          { lat:37.5665,  lon:126.9780  },
  'mexico city':    { lat:19.4326,  lon:-99.1332  },
  'san juan':       { lat:18.4655,  lon:-66.1057  },
  'nassau':         { lat:25.0443,  lon:-77.3504  },
  'montego bay':    { lat:18.4762,  lon:-77.8939  },
  'fort lauderdale':{ lat:26.1224,  lon:-80.1373  },
  'newark':         { lat:40.7357,  lon:-74.1724  },
  'san antonio':    { lat:29.4241,  lon:-98.4936  },
  'tucson':         { lat:32.2226,  lon:-110.9747 },
  'albuquerque':    { lat:35.0844,  lon:-106.6504 },
};

// Haversine distance in miles between two lat/lon points
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find airports near a typed city name (within 100 miles)
export function searchAirportsByCity(query: string): Airport[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const cityCoords = CITY_COORDS[q];
  if (cityCoords) {
    return AIRPORTS
      .map(a => ({ ...a, dist: haversine(cityCoords.lat, cityCoords.lon, a.lat, a.lon) }))
      .filter(a => (a.dist ?? Infinity) <= 100)
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  }

  // Fallback: fuzzy match on city, name, code, or state
  return AIRPORTS.filter(a =>
    a.city.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.code.toLowerCase().includes(q) ||
    a.state.toLowerCase().includes(q)
  ).slice(0, 8);
}

// Find road trip cities matching a query string
export function searchRoadtripCities(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return ROADTRIP_CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
}
