class UserPreferencesService {
  constructor() {
    this.defaultColumns = [
      { key: 'full_name', label: 'Name', visible: true, order: 1 },
      { key: 'email', label: 'Email', visible: true, order: 2 },
      { key: 'phone', label: 'Phone', visible: true, order: 3 },
      { key: 'current_title', label: 'Current Role', visible: true, order: 4 },
      { key: 'current_employer', label: 'Employer', visible: true, order: 5 },
      { key: 'salary_min', label: 'Min Salary', visible: false, order: 6 },
      { key: 'salary_max', label: 'Max Salary', visible: false, order: 7 },
      { key: 'tags', label: 'Tags', visible: true, order: 8 },
      { key: 'skills', label: 'Skills', visible: true, order: 9 },
      { key: 'created_at', label: 'Added Date', visible: false, order: 10 },
      { key: 'notes', label: 'Notes', visible: false, order: 11 }
    ];
    
    this.availableColumns = [
      ...this.defaultColumns,
      { key: 'seniority', label: 'Seniority', visible: false, order: 12 },
      { key: 'parse_status', label: 'Parse Status', visible: false, order: 13 },
      { key: 'needs_review', label: 'Needs Review', visible: false, order: 14 },
      { key: 'email_ok', label: 'Email OK', visible: false, order: 15 }
    ];
  }

  // Get user preferences (in a real app, this would be stored in database)
  getUserPreferences(userId = 'default') {
    // For now, return default preferences
    // In production, this would fetch from database
    return {
      userId,
      columns: this.defaultColumns,
      viewMode: 'table', // table, grid, list
      pageSize: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
      filters: {
        showOnlyWithEmail: false,
        showOnlyWithPhone: false,
        showOnlyWithSalary: false
      },
      savedFilters: [], // Array of saved Library filters
      lastUpdated: new Date().toISOString()
    };
  }

  // Update user preferences
  updateUserPreferences(userId, preferences) {
    const currentPrefs = this.getUserPreferences(userId);
    
    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
      lastUpdated: new Date().toISOString()
    };
    
    // Validate column preferences
    if (preferences.columns) {
      updatedPrefs.columns = this.validateColumns(preferences.columns);
    }
    
    // In production, save to database
    console.log(`[user-preferences] Updated preferences for user ${userId}:`, updatedPrefs);
    
    return updatedPrefs;
  }

  // Validate and normalize column preferences
  validateColumns(columns) {
    if (!Array.isArray(columns)) {
      return this.defaultColumns;
    }
    
    return columns
      .filter(col => col && col.key && col.label)
      .map(col => ({
        key: col.key,
        label: col.label,
        visible: Boolean(col.visible),
        order: Number(col.order) || 999,
        width: col.width || 'auto'
      }))
      .sort((a, b) => a.order - b.order);
  }

  // Get available columns for customization
  getAvailableColumns() {
    return this.availableColumns;
  }

  // Get column configuration for a specific view
  getColumnConfig(userId, viewType = 'candidates') {
    const preferences = this.getUserPreferences(userId);
    const visibleColumns = preferences.columns.filter(col => col.visible);
    
    return {
      columns: visibleColumns,
      totalColumns: preferences.columns.length,
      viewType,
      customizable: true
    };
  }

  // Reset to default preferences
  resetToDefaults(userId) {
    return this.updateUserPreferences(userId, {
      columns: this.defaultColumns,
      viewMode: 'table',
      pageSize: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
      filters: {
        showOnlyWithEmail: false,
        showOnlyWithPhone: false,
        showOnlyWithSalary: false
      }
    });
  }

  // Get column statistics
  getColumnStats() {
    return {
      totalAvailable: this.availableColumns.length,
      defaultVisible: this.defaultColumns.filter(col => col.visible).length,
      customizable: this.availableColumns.length,
      categories: {
        basic: ['full_name', 'email', 'phone'],
        professional: ['current_title', 'current_employer', 'seniority'],
        financial: ['salary_min', 'salary_max'],
        metadata: ['tags', 'skills', 'created_at', 'parse_status'],
        communication: ['email_ok', 'needs_review']
      }
    };
  }

  // Export preferences for backup
  exportPreferences(userId) {
    const preferences = this.getUserPreferences(userId);
    return {
      userId,
      preferences,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  // Import preferences from backup
  importPreferences(userId, backupData) {
    if (!backupData || !backupData.preferences) {
      throw new Error('Invalid backup data');
    }
    
    return this.updateUserPreferences(userId, backupData.preferences);
  }

  // Saved Filters methods
  saveFilter(userId, filterData) {
    const currentPrefs = this.getUserPreferences(userId);
    const newFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: filterData.name,
      skill: filterData.skill,
      band: filterData.band,
      searchKeyword: filterData.searchKeyword || '',
      columns: filterData.columns || currentPrefs.columns,
      pageSize: filterData.pageSize || currentPrefs.pageSize,
      sortBy: filterData.sortBy || currentPrefs.sortBy,
      sortOrder: filterData.sortOrder || currentPrefs.sortOrder,
      filters: filterData.filters || currentPrefs.filters,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    const updatedPrefs = {
      ...currentPrefs,
      savedFilters: [...(currentPrefs.savedFilters || []), newFilter],
      lastUpdated: new Date().toISOString()
    };

    console.log(`[user-preferences] Saved filter for user ${userId}:`, newFilter);
    return updatedPrefs;
  }

  getSavedFilters(userId) {
    const prefs = this.getUserPreferences(userId);
    return prefs.savedFilters || [];
  }

  updateSavedFilter(userId, filterId, updates) {
    const currentPrefs = this.getUserPreferences(userId);
    const savedFilters = currentPrefs.savedFilters || [];
    
    const updatedFilters = savedFilters.map(filter => 
      filter.id === filterId 
        ? { ...filter, ...updates, lastUpdated: new Date().toISOString() }
        : filter
    );

    const updatedPrefs = {
      ...currentPrefs,
      savedFilters: updatedFilters,
      lastUpdated: new Date().toISOString()
    };

    console.log(`[user-preferences] Updated filter ${filterId} for user ${userId}`);
    return updatedPrefs;
  }

  deleteSavedFilter(userId, filterId) {
    const currentPrefs = this.getUserPreferences(userId);
    const savedFilters = currentPrefs.savedFilters || [];
    
    const updatedFilters = savedFilters.filter(filter => filter.id !== filterId);

    const updatedPrefs = {
      ...currentPrefs,
      savedFilters: updatedFilters,
      lastUpdated: new Date().toISOString()
    };

    console.log(`[user-preferences] Deleted filter ${filterId} for user ${userId}`);
    return updatedPrefs;
  }

  applySavedFilter(userId, filterId) {
    const currentPrefs = this.getUserPreferences(userId);
    const savedFilters = currentPrefs.savedFilters || [];
    const filter = savedFilters.find(f => f.id === filterId);
    
    if (!filter) {
      throw new Error('Saved filter not found');
    }

    // Update last used timestamp
    const updatedFilters = savedFilters.map(f => 
      f.id === filterId 
        ? { ...f, lastUsed: new Date().toISOString() }
        : f
    );

    const updatedPrefs = {
      ...currentPrefs,
      columns: filter.columns,
      pageSize: filter.pageSize,
      sortBy: filter.sortBy,
      sortOrder: filter.sortOrder,
      filters: filter.filters,
      savedFilters: updatedFilters,
      lastUpdated: new Date().toISOString()
    };

    console.log(`[user-preferences] Applied filter ${filterId} for user ${userId}`);
    return updatedPrefs;
  }

  // Generate deep-linkable URL for a saved filter
  generateFilterUrl(filter) {
    const params = new URLSearchParams();
    
    if (filter.skill) params.set('skill', filter.skill);
    if (filter.band) params.set('band', filter.band);
    if (filter.searchKeyword) params.set('search', filter.searchKeyword);
    if (filter.pageSize) params.set('pageSize', filter.pageSize.toString());
    if (filter.sortBy) params.set('sortBy', filter.sortBy);
    if (filter.sortOrder) params.set('sortOrder', filter.sortOrder);
    
    // Add column visibility
    if (filter.columns) {
      const visibleColumns = filter.columns.filter(col => col.visible).map(col => col.key);
      if (visibleColumns.length > 0) {
        params.set('columns', visibleColumns.join(','));
      }
    }

    return `/candidates?${params.toString()}`;
  }

  // Parse URL parameters into filter state
  parseFilterFromUrl(searchParams) {
    const params = new URLSearchParams(searchParams);
    
    return {
      skill: params.get('skill') || null,
      band: params.get('band') || null,
      searchKeyword: params.get('search') || '',
      pageSize: parseInt(params.get('pageSize')) || 20,
      sortBy: params.get('sortBy') || 'created_at',
      sortOrder: params.get('sortOrder') || 'desc',
      columns: params.get('columns') ? params.get('columns').split(',') : null
    };
  }
}

module.exports = UserPreferencesService;
