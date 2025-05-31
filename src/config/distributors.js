// Configuration for all distributors
export const DISTRIBUTORS = {
  default: {
    id: 'default',
    name: 'Default Storefront',
    slug: 'default',
    domain: 'localhost',
    theme: 'default'
  },
  oceanwave: {
    id: 1,
    name: 'Ocean Wave Foods', 
    slug: 'oceanwave',
    domain: 'www.featherstorefront.com',
    theme: 'oceanwave'
  },
  palma: {
    id: 2,
    name: 'Palma Cigars',
    slug: 'palma', 
    domain: 'palmacigars.featherstorefront.com',
    theme: 'palma'
  }
};

export function getDistributorByDomain(hostname) {
  for (const [slug, config] of Object.entries(DISTRIBUTORS)) {
    if (config.domain === hostname) {
      return { slug, ...config };
    }
  }
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return { slug: 'oceanwave', ...DISTRIBUTORS.oceanwave };
  }
  
  return { slug: 'default', ...DISTRIBUTORS.default };
}

export function getDistributorById(distributorId) {
  for (const [slug, config] of Object.entries(DISTRIBUTORS)) {
    if (config.id === distributorId) {
      return { slug, ...config };
    }
  }
  return { slug: 'default', ...DISTRIBUTORS.default };
}
