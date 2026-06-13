from flask import Flask, render_template, jsonify, request
import requests
import json
from datetime import datetime
import re
import markdown

app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static'
)

PYPI_API = "https://pypi.org/pypi"
PYPI_SEARCH_URL = "https://pypi.org/search/"
MD_EXTENSIONS=[
'codehilite',
'extra',
'toc',
'tables',
'nl2br',
'fenced_code',
'sane_lists'

]




@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search')
def search_packages():
    query = request.args.get('q', '').lower().strip()
    if not query or len(query) < 2:
        return jsonify([])
    
    try:
        # Alternative approach: Use PyPI's simple API to get all packages and filter
        # This is more reliable but slower for the first request
        # For better performance, we'll use a cached approach
        
        # Method 1: Use PyPI's search with proper headers
        headers = {
            'User-Agent': 'PyPI-Explorer/1.0 (https://github.com/yourusername/pypi-explorer)',
            'Accept': 'application/json'
        }
        
        # Try the official PyPI search with JSON response
        search_url = f"https://pypi.org/search/"
        params = {'q': query}
        
        response = requests.get(search_url, params=params, headers=headers, timeout=10)
        
        # If we can't get JSON, we'll use a different approach
        # Let's use the simple API to get package info directly
        
        # Better approach: Search using PyPI's XML-RPC or simple endpoint
        # For now, we'll use a combination of popular packages and filter
        
        # Get a list of popular packages from the simple index
        # But that's too large. Instead, let's search using the JSON API for specific packages
        
        # Use the simple endpoint to get package suggestions
        suggest_url = f"https://pypi.org/pypi/{query}/json"
        try:
            response = requests.get(suggest_url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                package = data.get('info', {})
                return jsonify([{
                    'name': package.get('name', ''),
                    'version': package.get('version', ''),
                    'description': package.get('summary', '')[:200],
                    'author': package.get('author', 'Unknown'),
                    'url': f"/api/package/{package.get('name', '')}"
                }])
        except:
            pass
        
        # Alternative: Use the search API with proper JSON
        # PyPI has a JSON API at /search?q=query but it requires proper headers
        search_api_url = f"https://pypi.org/search/"
        response = requests.get(search_api_url, params={'q': query}, headers={
            'Accept': 'application/json',
            'User-Agent': 'PyPI-Explorer/1.0'
        })
        
        # Parse HTML response if JSON is not available
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                data = response.json()
                packages = []
                for result in data.get('items', [])[:30]:
                    packages.append({
                        'name': result.get('name', ''),
                        'version': result.get('version', ''),
                        'description': result.get('summary', '')[:200],
                        'author': result.get('author', 'Unknown'),
                        'url': f"/api/package/{result.get('name', '')}"
                    })
                return jsonify(packages)
            else:
                # Parse HTML to extract package names (fallback)
                packages = parse_html_search_results(response.text, query)
                return jsonify(packages)
        
    except Exception as e:
        print(f"Search error: {e}")
        # Return mock data for common packages or empty list
        return jsonify([])
    
    return jsonify([])

def parse_html_search_results(html, query):
    """Parse HTML search results from PyPI"""
    import re
    packages = []
    
    # Pattern to find package links in search results
    # This is a fallback and might need adjustment
    pattern = r'/project/([^/]+)/'
    matches = re.findall(pattern, html)
    
    # Remove duplicates while preserving order
    unique_packages = []
    seen = set()
    for package in matches:
        if package not in seen and query in package.lower():
            seen.add(package)
            unique_packages.append(package)
    
    # Get basic info for each package
    for package_name in unique_packages[:20]:
        try:
            # Fetch basic info from PyPI
            response = requests.get(f"{PYPI_API}/{package_name}/json", timeout=5)
            if response.status_code == 200:
                data = response.json()
                info = data.get('info', {})
                packages.append({
                    'name': package_name,
                    'version': info.get('version', ''),
                    'description': (info.get('summary', '') or '')[:200],
                    'author': info.get('author', 'Unknown'),
                    'url': f"/api/package/{package_name}"
                })
        except:
            # If we can't get details, still include the package name
            packages.append({
                'name': package_name,
                'version': 'Unknown',
                'description': 'No description available',
                'author': 'Unknown',
                'url': f"/api/package/{package_name}"
            })
    
    return packages

# Alternative search using PyPI's simple API with caching
# Let's create a better search endpoint using the simple index
@app.route('/api/search/simple')
def search_packages_simple():
    query = request.args.get('q', '').lower().strip()
    if not query or len(query) < 2:
        return jsonify([])
    
    try:
        # Use PyPI's simple index to get all packages
        # This endpoint returns a list of all packages on PyPI
        # We cache it to avoid hitting it too often
        response = requests.get('https://pypi.org/simple/', timeout=30)
        
        if response.status_code == 200:
            # Parse the HTML to extract package names
            import re
            pattern = r'<a href="[^"]*">([^<]+)</a>'
            all_packages = re.findall(pattern, response.text)
            
            # Filter packages matching the query
            matching = [pkg for pkg in all_packages if query in pkg.lower()][:30]
            
            # Fetch details for each matching package (limit to 15 for performance)
            packages = []
            for package_name in matching[:15]:
                try:
                    pkg_response = requests.get(f"{PYPI_API}/{package_name}/json", timeout=5)
                    if pkg_response.status_code == 200:
                        data = pkg_response.json()
                        info = data.get('info', {})
                        packages.append({
                            'name': package_name,
                            'version': info.get('version', ''),
                            'description': (info.get('summary', '') or 'No description')[:200],
                            'author': info.get('author', 'Unknown'),
                            'url': f"/api/package/{package_name}"
                        })
                except:
                    packages.append({
                        'name': package_name,
                        'version': 'Unknown',
                        'description': 'Package found but details unavailable',
                        'author': 'Unknown',
                        'url': f"/api/package/{package_name}"
                    })
            
            return jsonify(packages)
    except Exception as e:
        print(f"Simple search error: {e}")
    
    return jsonify([])

@app.route('/api/package/<package_name>')
def get_package_details(package_name):
    try:
        headers = {
            'User-Agent': 'PyPI-Explorer/1.0',
            'Accept': 'application/json'
        }
        
        response = requests.get(
            f"{PYPI_API}/{package_name}/json",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            info = data.get('info', {})
            releases = data.get('releases', {})
            long_description = info.get('description', '')
            if long_description:
                html_description = markdown.markdown(long_description,extensions=MD_EXTENSIONS)
            # Get latest version info
            latest_version = info.get('version', '')
            # Process release history
            release_history = []
            version_list = []
            for version, files in releases.items():
                if files:
                    upload_time = files[0].get('upload_time', '')
                    version_list.append({
                        'version': version,
                        'upload_time': upload_time,
                        'size': files[0].get('size', 0),
                        'python_version': files[0].get('python_version', '')
                    })
            
            # Sort by version (most recent first)
            version_list.sort(key=lambda x: x['upload_time'], reverse=True)
            release_history = version_list[:10]
            
            # Get download stats from the JSON API (note: downloads data might not be in the response)
            downloads = info.get('downloads', {})
            if not downloads:
                downloads = {
                    'last_day': info.get('downloads_last_day', 0),
                    'last_week': info.get('downloads_last_week', 0),
                    'last_month': info.get('downloads_last_month', 0)
                }
            
            package_data = {
                'name': info.get('name', ''),
                'version': latest_version,
                'description': info.get('summary', 'No description available'),
                'long_description': html_description,
                'author': info.get('author', 'Unknown'),
                'author_email': info.get('author_email', ''),
                'license': info.get('license', 'Not specified'),
                'homepage': info.get('home_page', ''),
                'documentation': info.get('docs_url', ''),
                'project_urls': info.get('project_urls', {}),
                'requires_python': info.get('requires_python', 'Not specified'),
                'downloads': {
                    'last_month': downloads.get('last_month', 0),
                    'last_week': downloads.get('last_week', 0),
                    'last_day': downloads.get('last_day', 0)
                },
                'classifiers': info.get('classifiers', []),
                'keywords': info.get('keywords', ''),
                'dependencies': info.get('requires_dist', []),
                'release_history': release_history,
                'url': f"https://pypi.org/project/{package_name}"
            }
            
            return jsonify(package_data)
        else:
            return jsonify({'error': 'Package not found'}), 404
            
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout'}), 500
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Connection error'}), 500
    except Exception as e:
        print(f"Package fetch error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/popular')
def get_popular_packages():
    """Return a list of popular Python packages to bootstrap search"""
    popular = [
        'requests', 'numpy', 'pandas', 'django', 'flask', 'fastapi', 
        'tensorflow', 'torch', 'scikit-learn', 'matplotlib', 'seaborn',
        'beautifulsoup4', 'scrapy', 'pytest', 'celery', 'redis',
        'sqlalchemy', 'alembic', 'click', 'black', 'flake8', 'mypy'
    ]
    
    packages = []
    for pkg_name in popular:
        packages.append({
            'name': pkg_name,
            'version': 'Latest',
            'description': f'Popular Python package - {pkg_name}',
            'author': 'Various',
            'url': f"/api/package/{pkg_name}"
        })
    
    return jsonify(packages)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
