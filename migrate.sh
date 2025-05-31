#!/bin/bash
# Migration script to restructure Feather Storefront
# Run this in your project root directory

echo "Creating new directory structure..."

# Create directories
mkdir -p src/distributors/default/components
mkdir -p src/distributors/oceanwave/components  
mkdir -p src/distributors/palma/components
mkdir -p src/shared/hooks
mkdir -p src/shared/utils
mkdir -p src/config

echo "Copying files to default distributor..."

# Copy component files to default
cp src/AdminLogin.jsx src/distributors/default/components/
cp src/Backoffice.jsx src/distributors/default/components/
cp src/BackofficeOptions.jsx src/distributors/default/components/
cp src/Branding.jsx src/distributors/default/components/
cp src/Cart.jsx src/distributors/default/components/
cp src/OrderHistory.jsx src/distributors/default/components/
cp src/Storefront.jsx src/distributors/default/components/

# Copy main files to default
cp src/App.jsx src/distributors/default/
cp src/main.jsx src/distributors/default/
cp src/index.css src/distributors/default/

# Move shared utilities
cp src/useTitleEffect.js src/shared/hooks/

echo "Copying default to other distributors..."

# Copy default to oceanwave
cp -r src/distributors/default/* src/distributors/oceanwave/

# Copy default to palma
cp -r src/distributors/default/* src/distributors/palma/

echo "Creating config files..."

# Create distributor config
cat > src/config/distributors.js << 'EOF'
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
EOF

echo "Migration complete!"
echo "Next steps:"
echo "1. Update index.html"
echo "2. Update main.jsx files in each distributor folder"
echo "3. Update import paths in components"