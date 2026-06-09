// Helper function to normalize supply names (remove quantities in parentheses)
export const normalizeSupplyName = (supplyName) => {
  if (!supplyName) return '';
  // Remove patterns like " (1)", " (2)", etc.
  return supplyName.replace(/\s*\(\d+\)$/, '');
};

// Helper function to pluralize supply names
export const pluralize = (count, singular, plural) => {
  return count === 1 ? singular : plural;
};

// Helper function to get the correct plural form of a supply name
export const getPluralForm = (supplyName) => {
  // Handle common irregular plurals
  const irregularPlurals = {
    'pencil': 'pencils',
    'pen': 'pens',
    'calculator': 'calculators',
    'protractor': 'protractors',
    'ruler': 'rulers',
    'notebook': 'notebooks',
    'textbook': 'textbooks',
    'paper': 'papers',
    'marker': 'markers',
    'eraser': 'erasers',
    'scissors': 'scissors',
    'tape': 'tape',
    'stapler': 'staplers',
    'folder': 'folders',
    'binder': 'binders'
  };

  // Check if we have an irregular plural
  if (irregularPlurals[supplyName.toLowerCase()]) {
    return irregularPlurals[supplyName.toLowerCase()];
  }

  // Handle regular plurals
  if (supplyName.toLowerCase().endsWith('s')) {
    // If it already ends with 's', just return as is
    return supplyName;
  }

  // Add 's' for regular plurals
  return supplyName + 's';
};

// Helper function to get supply summary for logging
export const getSupplySummary = (supplies) => {
  if (!supplies || supplies.length === 0) return { summary: '', count: 0 };

  // Normalize all supply names and count them, preserving initial supply status
  const supplyCounts = {};

  supplies.forEach(supply => {
    if (supply.startsWith('INITIAL_')) {
      const cleanName = supply.replace('INITIAL_', '');
      const normalizedName = normalizeSupplyName(cleanName);
      const key = `${normalizedName} (initial)`;
      supplyCounts[key] = (supplyCounts[key] || 0) + 1;
    } else {
      const normalizedName = normalizeSupplyName(supply);
      supplyCounts[normalizedName] = (supplyCounts[normalizedName] || 0) + 1;
    }
  });

  // Create summary string
  const summaryParts = Object.entries(supplyCounts).map(([supply, count]) => {
    if (supply.includes('(initial)')) {
      const baseSupply = supply.replace(' (initial)', '');
      const pluralized = pluralize(count, baseSupply, getPluralForm(baseSupply));
      return `${count} ${pluralized} (initial)`;
    } else {
      const pluralized = pluralize(count, supply, getPluralForm(supply));
      return `${count} ${pluralized}`;
    }
  });

  return {
    summary: summaryParts.join(', '),
    count: supplies.length,
    individualCounts: supplyCounts
  };
};
