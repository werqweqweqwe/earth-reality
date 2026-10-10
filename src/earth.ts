export type GeoLocation = {
  name: string;
  type: 'City' | 'Continent' | 'Ocean' | 'Region' | 'Landmass';
  lat: number;
  lon: number;
  alt: number;
};

export const locationCatalog: GeoLocation[] = [
  { name: 'London', type: 'City', lat: 51.5074, lon: -0.1278, alt: 11 },
  { name: 'New York', type: 'City', lat: 40.7128, lon: -74.006, alt: 12 },
  { name: 'Tokyo', type: 'City', lat: 35.6762, lon: 139.6503, alt: 40 },
  { name: 'Rio de Janeiro', type: 'City', lat: -22.9068, lon: -43.1729, alt: 8 },
  { name: 'Cape Town', type: 'City', lat: -33.9249, lon: 18.4241, alt: 42 },
  { name: 'Singapore', type: 'City', lat: 1.3521, lon: 103.8198, alt: 15 },
  { name: 'Pacific Ocean', type: 'Ocean', lat: 0, lon: -150, alt: -4300 },
  { name: 'Atlantic Ocean', type: 'Ocean', lat: 0, lon: -20, alt: -4000 },
  { name: 'Indian Ocean', type: 'Ocean', lat: -10, lon: 80, alt: -3900 },
  { name: 'Arctic Circle', type: 'Region', lat: 66.56, lon: 0, alt: 0 },
  { name: 'Greenland', type: 'Landmass', lat: 72.3, lon: -42, alt: 2100 },
  { name: 'Antarctica', type: 'Landmass', lat: -90, lon: 0, alt: 2800 },
  { name: 'Africa', type: 'Continent', lat: 0, lon: 20, alt: 650 },
  { name: 'Europe', type: 'Continent', lat: 50, lon: 12, alt: 400 },
  { name: 'Asia', type: 'Continent', lat: 35, lon: 90, alt: 700 },
  { name: 'South America', type: 'Continent', lat: -15, lon: -60, alt: 650 },
  { name: 'North America', type: 'Continent', lat: 50, lon: -100, alt: 500 },
  { name: 'Australia', type: 'Continent', lat: -25, lon: 133, alt: 300 },
];
