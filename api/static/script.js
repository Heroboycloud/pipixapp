let searchTimeout;
let currentSearchTerm = '';

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const packageDetails = document.getElementById('packageDetails');
const searchSpinner = document.querySelector('.search-spinner');
const clearSearch = document.getElementById('clearSearch');

// Add clear button functionality
if (clearSearch) {
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        hideSearchResults();
        loadPopularPackages();
    });
}

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    currentSearchTerm = query;
    
    if (query.length > 0) {
        clearSearch.style.display = 'block';
    } else {
        clearSearch.style.display = 'none';
    }
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
        hideSearchResults();
        if (query.length === 0) {
            loadPopularPackages();
        }
        return;
    }
    
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 300);
});

// Filter chips
document.querySelectorAll('.filter-chip, .suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const packageName = chip.getAttribute('data-package');
        if (packageName) {
            searchInput.value = packageName;
            loadPackage(packageName);
            hideSearchResults();
        }
    });
});

async function performSearch(query) {
    if (query !== currentSearchTerm) return;
    
    searchSpinner.style.display = 'block';
    searchResults.innerHTML = '<div class="result-item">Searching...</div>';
    searchResults.classList.add('active');
    
    try {
        let response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        let packages = await response.json();
        
        if (packages.length === 0) {
            response = await fetch(`/api/search/simple?q=${encodeURIComponent(query)}`);
            packages = await response.json();
        }
        
        if (query === currentSearchTerm) {
            if (packages.length === 0) {
                displayNoResults();
            } else {
                displaySearchResults(packages);
            }
        }
    } catch (error) {
        console.error('Search error:', error);
        if (query === currentSearchTerm) {
            displaySearchError();
        }
    } finally {
        searchSpinner.style.display = 'none';
    }
}

async function loadPopularPackages() {
    try {
        const response = await fetch('/api/popular');
        const packages = await response.json();
        displaySearchResults(packages);
        searchResults.classList.add('active');
    } catch (error) {
        console.error('Error loading popular packages:', error);
    }
}

function displaySearchResults(packages) {
    if (packages.length === 0) {
        displayNoResults();
        return;
    }
    
    searchResults.innerHTML = packages.map(pkg => `
        <div class="result-item" onclick="loadPackage('${escapeHtml(pkg.name)}')">
            <div class="result-name">
                ${escapeHtml(pkg.name)}
                <span class="result-version">${escapeHtml(pkg.version)}</span>
            </div>
            <div class="result-description">${escapeHtml(pkg.description || 'No description')}</div>
        </div>
    `).join('');
    
    searchResults.classList.add('active');
}

function displayNoResults() {
    searchResults.innerHTML = '<div class="result-item">✨ No packages found. Try a different search term.</div>';
    searchResults.classList.add('active');
}

function displaySearchError() {
    searchResults.innerHTML = '<div class="result-item">⚠️ Search failed. Please try again.</div>';
    searchResults.classList.add('active');
}

async function loadPackage(packageName) {
    hideSearchResults();
    searchInput.value = packageName;
    
    packageDetails.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <i class="fas fa-spinner fa-pulse"></i>
            </div>
            <h3>Loading Package Details</h3>
            <p>Fetching information for ${escapeHtml(packageName)}...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/package/${packageName}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        if (data.error) {
            displayError(data.error);
        } else {
            displayPackageDetails(data);
        }
    } catch (error) {
        console.error('Error loading package:', error);
        displayError('Failed to load package details. Please try again.');
    }
}

function displayPackageDetails(pkg) {
    packageDetails.innerHTML = `
        <div class="package-header">
            <div class="package-name">
                ${escapeHtml(pkg.name)}
                <span class="package-version">v${escapeHtml(pkg.version)}</span>
            </div>
            <div class="package-meta">
                <div class="meta-item">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(pkg.author)}</span>
                </div>
                ${pkg.license && pkg.license !== 'Not specified' && pkg.license !== 'UNKNOWN' ? `
                <div class="meta-item">
                    <i class="fas fa-balance-scale"></i>
                    <span>${escapeHtml(pkg.license)}</span>
                </div>
                ` : ''}
                <div class="meta-item">
                    <i class="fab fa-python"></i>
                    <span>${escapeHtml(pkg.requires_python)}</span>
                </div>
                ${pkg.release_history && pkg.release_history.length > 0 ? `
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Updated: ${formatDate(pkg.release_history[0]?.upload_time)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="package-description">
            ${pkg.description || 'No description available'}
        </div>
        
        ${pkg.long_description && pkg.long_description.trim() ? `
        <div class="section">
            <div class="section-title">
                <i class="fas fa-align-left"></i>
                <span>Full Description</span>
            </div>
            <div class="info-value description-text">${pkg.long_description.substring(0, 10000)}${pkg.long_description.length > 10000 ? '...' : ''}</div>
        </div>
        ` : ''}
        
        <div class="section">
            <div class="section-title">
                <i class="fas fa-info-circle"></i>
                <span>Package Information</span>
            </div>
            <div class="info-grid">
                ${pkg.homepage ? `
                <div class="info-card">
                    <div class="info-label">Homepage</div>
                    <div class="info-value">
                        <a href="${escapeHtml(pkg.homepage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pkg.homepage)}</a>
                    </div>
                </div>
                ` : ''}
                ${pkg.documentation ? `
                <div class="info-card">
                    <div class="info-label">Documentation</div>
                    <div class="info-value">
                        <a href="${escapeHtml(pkg.documentation)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pkg.documentation)}</a>
                    </div>
                </div>
                ` : ''}
                <div class="info-card">
                    <div class="info-label">PyPI URL</div>
                    <div class="info-value">
                        <a href="${escapeHtml(pkg.url)}" target="_blank" rel="noopener noreferrer">View on PyPI <i class="fas fa-external-link-alt"></i></a>
                    </div>
                </div>
                ${pkg.keywords ? `
                <div class="info-card">
                    <div class="info-label">Keywords</div>
                    <div class="info-value">${escapeHtml(pkg.keywords)}</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${pkg.downloads && (pkg.downloads.last_day > 0 || pkg.downloads.last_week > 0 || pkg.downloads.last_month > 0) ? `
        <div class="section">
            <div class="section-title">
                <i class="fas fa-chart-line"></i>
                <span>Download Statistics</span>
            </div>
            <div class="download-stats">
                <div class="stat">
                    <div class="stat-number">${formatNumber(pkg.downloads.last_day)}</div>
                    <div class="stat-label">Last 24 hours</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${formatNumber(pkg.downloads.last_week)}</div>
                    <div class="stat-label">Last 7 days</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${formatNumber(pkg.downloads.last_month)}</div>
                    <div class="stat-label">Last 30 days</div>
                </div>
            </div>
        </div>
        ` : ''}
        
        ${pkg.dependencies && pkg.dependencies.length > 0 ? `
        <div class="section">
            <div class="section-title">
                <i class="fas fa-link"></i>
                <span>Dependencies</span>
            </div>
            <div class="dependencies-list">
                ${pkg.dependencies.slice(0, 15).map(dep => `<div class="dependency-item">${escapeHtml(dep)}</div>`).join('')}
                ${pkg.dependencies.length > 15 ? `<div class="dependency-item">... and ${pkg.dependencies.length - 15} more</div>` : ''}
            </div>
        </div>
        ` : ''}
        
        ${pkg.classifiers && pkg.classifiers.length > 0 ? `
        <div class="section">
            <div class="section-title">
                <i class="fas fa-tags"></i>
                <span>Classifiers</span>
            </div>
            <div class="classifiers">
                ${pkg.classifiers.slice(0, 20).map(c => `<span class="classifier-tag">${escapeHtml(c)}</span>`).join('')}
                ${pkg.classifiers.length > 20 ? `<span class="classifier-tag">+${pkg.classifiers.length - 20} more</span>` : ''}
            </div>
        </div>
        ` : ''}
        
        ${pkg.release_history && pkg.release_history.length > 0 ? `
        <div class="section">
            <div class="section-title">
                <i class="fas fa-history"></i>
                <span>Recent Releases</span>
            </div>
            <div class="release-table">
                <table>
                    <thead>
                        <tr><th>Version</th><th>Upload Date</th><th>Python Version</th><th>Size</th></tr>
                    </thead>
                    <tbody>
                        ${pkg.release_history.slice(0, 10).map(release => `
                            <tr>
                                <td><strong>${escapeHtml(release.version)}</strong></td>
                                <td>${formatDate(release.upload_time)}</td>
                                <td>${escapeHtml(release.python_version) || 'Any'}</td>
                                <td>${formatBytes(release.size)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
    `;
}

function displayError(message) {
    packageDetails.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function hideSearchResults() {
    searchResults.classList.remove('active');
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Unknown';
    }
}

function formatNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput && e.target !== clearSearch) {
        hideSearchResults();
    }
});

// Add keyboard shortcuts
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideSearchResults();
        searchInput.blur();
    }
});
