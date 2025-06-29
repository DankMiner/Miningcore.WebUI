/*!
 * Miningcore.js v3.0 - Enhanced with Modern Chart.js Charts
 * Features: Real-time updates, interactive tooltips, zoom/pan, multiple timeframes, gradient fills
 */

// Global Variables
var WebURL = window.location.protocol + "//" + window.location.hostname + "/";
if (WebURL.substring(WebURL.length-1) != "/") {
    WebURL = WebURL + "/";
}

// Update pool cards with USD price information
function updatePoolCardsWithPrices(poolsWithPrices) {
    console.log('Updating pool cards with price information');
    
    poolsWithPrices.forEach(pool => {
        // Find the corresponding pool card
        const poolCard = $(`.pool-card[href="#${pool.id}/stats"]`);
        if (poolCard.length > 0) {
            // Find the "Total Paid" stat value element
            const totalPaidElement = poolCard.find('.pool-card-stat-label:contains("Total Paid")').next('.pool-card-stat-value');
            
            if (totalPaidElement.length > 0) {
                let formattedValue = "N/A";
                
                if (pool.totalPaidUSD !== undefined && pool.totalPaidUSD > 0) {
                    // Format USD values nicely
                    if (pool.totalPaidUSD >= 1000000) {
                        formattedValue = "$" + (pool.totalPaidUSD / 1000000).toFixed(1) + "M";
                    } else if (pool.totalPaidUSD >= 1000) {
                        formattedValue = "$" + (pool.totalPaidUSD / 1000).toFixed(1) + "K";
                    } else if (pool.totalPaidUSD >= 1) {
                        formattedValue = "$" + pool.totalPaidUSD.toFixed(0);
                    } else if (pool.totalPaidUSD > 0) {
                        formattedValue = "$" + pool.totalPaidUSD.toFixed(2);
                    } else {
                        formattedValue = "$0";
                    }
                }
                
                // Update the value with a smooth animation
                totalPaidElement.fadeOut(200, function() {
                    $(this).text(formattedValue).fadeIn(200);
                });
            }
        }
    });
}

var API = "https://1miner.net/api/";
if (API.substring(API.length-1) != "/") {
    API = API + "/";
}

// Add debug logging for API calls
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (window.debugMode || window.location.search.includes('debug=true')) {
            console.log('API Request:', settings.type, settings.url);
        }
    },
    complete: function(xhr, status) {
        if (window.debugMode || window.location.search.includes('debug=true')) {
            console.log('API Response:', status, xhr.status);
            if (xhr.responseJSON) {
                console.log('Response data:', xhr.responseJSON);
            }
        }
    }
});

var stratumAddress = window.location.hostname;
var currentPage = "index";
var currentPool = null;
var currentAddress = null;
var minerBlocks = {};

// Chart instances storage
window.chartInstances = window.chartInstances || {};
window.currentDashboardAddress = null;
window.dailyPaymentChartData = null;

// Interval management
var activeIntervals = [];
var activePingInterval = null;

console.log('MiningCore.WebUI:', WebURL);
console.log('API address:', API);
console.log('Stratum address:', "stratum+tcp://" + stratumAddress + ":");

// Wait for Chart.js to be available
function waitForChartJS(callback) {
    if (typeof Chart !== 'undefined') {
        callback();
    } else {
        setTimeout(() => waitForChartJS(callback), 100);
    }
}

// Initialize Chart.js when ready
waitForChartJS(() => {
    console.log('Chart.js is ready, version:', Chart.version);
    
    // Chart.js default configuration
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';
    Chart.defaults.font.size = 12;
    
    // Set default color after DOM is ready
    $(document).ready(function() {
        Chart.defaults.color = getThemeColors().textSecondary;
    });
});

// Test function to create a simple chart with dummy data
function createTestChart(canvasId) {
    console.log('Creating test chart on canvas:', canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error('Canvas element not found:', canvasId);
        return;
    }
    
    const colors = getThemeColors();
    
    // Create simple test data
    const labels = [];
    const data = [];
    for (let i = 0; i < 10; i++) {
        labels.push(new Date(Date.now() - (9 - i) * 3600000));
        data.push(Math.random() * 100);
    }
    
    try {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Test Data',
                    data: data,
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + '20',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time'
                    }
                }
            }
        });
        console.log('Test chart created successfully');
    } catch (error) {
        console.error('Error creating test chart:', error);
    }
}

// Mobile detection
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth <= 768;
}

// Touch detection
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Clear all intervals
function clearAllIntervals() {
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals = [];
}

// Add interval to tracking
function addInterval(intervalId) {
    activeIntervals.push(intervalId);
}

// Get theme colors with fallback
function getThemeColors() {
    try {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        
        return {
            primary: computedStyle.getPropertyValue('--accent-primary').trim() || '#00d4ff',
            secondary: computedStyle.getPropertyValue('--accent-secondary').trim() || '#0099cc',
            success: computedStyle.getPropertyValue('--success').trim() || '#00ff88',
            warning: computedStyle.getPropertyValue('--warning').trim() || '#ffaa00',
            danger: computedStyle.getPropertyValue('--danger').trim() || '#ff4444',
            textPrimary: computedStyle.getPropertyValue('--text-primary').trim() || '#ffffff',
            textSecondary: computedStyle.getPropertyValue('--text-secondary').trim() || '#b0b0b0',
            textMuted: computedStyle.getPropertyValue('--text-muted').trim() || '#707070',
            bgPrimary: computedStyle.getPropertyValue('--bg-primary').trim() || '#0a0a0a',
            bgSecondary: computedStyle.getPropertyValue('--bg-secondary').trim() || '#1a1a1a',
            bgTertiary: computedStyle.getPropertyValue('--bg-tertiary').trim() || '#242424',
            borderColor: computedStyle.getPropertyValue('--border-color').trim() || '#333333',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            tooltipBg: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'
        };
    } catch (error) {
        console.error('Error getting theme colors:', error);
        // Return default dark theme colors
        return {
            primary: '#00d4ff',
            secondary: '#0099cc',
            success: '#00ff88',
            warning: '#ffaa00',
            danger: '#ff4444',
            textPrimary: '#ffffff',
            textSecondary: '#b0b0b0',
            textMuted: '#707070',
            bgPrimary: '#0a0a0a',
            bgSecondary: '#1a1a1a',
            bgTertiary: '#242424',
            borderColor: '#333333',
            gridColor: 'rgba(255, 255, 255, 0.05)',
            tooltipBg: 'rgba(26, 26, 26, 0.95)'
        };
    }
}

// Create gradient for charts
function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// Main page loader with mobile optimizations
function loadIndex() {
    // Clear previous intervals
    clearAllIntervals();
    stopPingMonitoring();
    
    $("div[class^='page-']").hide();
    $(".page").hide();
    
    var hashList = window.location.hash.split(/[#/?=]/);
    currentPool = hashList[1];
    currentPage = hashList[2] || hashList[1];
    currentAddress = hashList[3];
    
    // Close mobile menus
    closeMobileMenus();
    
    // Handle global pages (help, about)
    if (!currentPool || ['help', 'about'].includes(currentPool)) {
        $(".main-index").hide();
        $(".main-pool").show();
        $("#pool-sidebar").hide();
        $("#main-pool-nav").show();
        $(".pool-content").css('margin-left', '0');
        
        // Clear active states
        $(".pool-nav-link").removeClass("active");
        $(".sidebar-menu-link").removeClass("active");
        
        // Show appropriate page
        if (currentPool === 'help' || currentPage === 'help') {
            $(".page-help").show();
            $(".nav-help").addClass("active");
        } else if (currentPool === 'about' || currentPage === 'about') {
            $(".page-about").show();
            $(".nav-about").addClass("active");
        } else {
            // Show index page
            $(".main-index").show();
            $(".main-pool").hide();
            $("#main-pool-nav").hide();
            loadHomePage();
            // Initialize server ping on index page with delay
            setTimeout(() => {
                if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#index') {
                    initServerPingMonitoring();
                }
            }, 500);
        }
    } else if (currentPool && currentPage) {
        // Pool-specific pages
        loadNavigation();
        $(".main-index").hide();
        $(".main-pool").show();
        $(".page-" + currentPage).show();
        $("#pool-sidebar").show();
        $("#main-pool-nav").show();
        
        // Adjust layout for mobile
        if (isMobile()) {
            $(".pool-content").css('margin-left', '0');
        } else {
            $(".pool-content").css('margin-left', '240px');
        }
        
        // Update active states
        $("li[class^='nav-']").removeClass("active");
        $(".sidebar-menu-link").removeClass("active");
        $(".pool-nav-link").removeClass("active");
        
        // Load page-specific content
        switch (currentPage) {
            case "stats":
                console.log('Loading stats page');
                $(".nav-stats .sidebar-menu-link").addClass("active");
                loadStatsPage();
                break;
            case "dashboard":
                console.log('Loading dashboard page');
                $(".nav-dashboard .sidebar-menu-link").addClass("active");
                loadDashboardPage();
                break;
            case "miners":
                console.log('Loading miners page');
                $(".nav-miners .sidebar-menu-link").addClass("active");
                $(".nav-miners.pool-nav-link").addClass("active");
                loadMinersPage();
                break;
            case "blocks":
                console.log('Loading blocks page');
                $(".nav-blocks .sidebar-menu-link").addClass("active");
                $(".nav-blocks.pool-nav-link").addClass("active");
                loadBlocksEffortTable();
                loadBlocksPage();
                break;
            case "payments":
                console.log('Loading payments page');
                $(".nav-payments .sidebar-menu-link").addClass("active");
                $(".nav-payments.pool-nav-link").addClass("active");
                loadPaymentsPage();
                break;
            case "connect":
                console.log('Loading connect page');
                $(".nav-connect .sidebar-menu-link").addClass("active");
                loadConnectPage();
                break;
            case "faq":
                console.log('Loading FAQ page');
                $(".nav-faq .sidebar-menu-link").addClass("active");
                break;
            case "support":
                console.log('Loading support page');
                $(".nav-support .sidebar-menu-link").addClass("active");
                break;
        }
    } else if (currentPool && !currentPage) {
        // Default to stats page
        currentPage = "stats";
        window.location.hash = currentPool + "/stats";
    } else {
        // Show index page
        $(".main-index").show();
        $(".main-pool").hide();
        $("#main-pool-nav").hide();
        loadHomePage();
        // Initialize server ping on index page
        setTimeout(() => {
            initServerPingMonitoring();
        }, 500);
    }
    
    scrollPageTop();
}

// Close mobile menus
function closeMobileMenus() {
    $('#main-pool-nav').removeClass('active');
    $('#pool-sidebar').removeClass('active');
}

// Enhanced home page loader with mobile optimization
function loadHomePage() {
    console.log('Loading home page');
    return $.ajax(API + "pools")
        .done(function(data) {
            var poolCoinGridTemplate = "";

            // Sort pools by name
            let sortedPools = data.pools.sort((a, b) => {
                const nameA = (a.coin.canonicalName || a.coin.name || a.coin.type).toLowerCase();
                const nameB = (b.coin.canonicalName || b.coin.name || b.coin.type).toLowerCase();
                return nameA.localeCompare(nameB);
            });

            // First, create pool cards with loading state for USD values
            $.each(sortedPools, function(index, value) {
                value.totalPaidUSD = "loading"; // Set loading state
                poolCoinGridTemplate += generatePoolCard(value);
            });

            $(".pool-coin-grid").html(poolCoinGridTemplate);
            
            // Add entrance animation with stagger
            $('.pool-card').each(function(index) {
                $(this).css('animation-delay', (index * 0.05) + 's');
            });
            
            // Add touch event handling for mobile
            if (isTouchDevice()) {
                addTouchHandlers();
            }

            // Then load coin prices and update the USD values
            loadAllCoinPrices(sortedPools).then(poolsWithPrices => {
                updatePoolCardsWithPrices(poolsWithPrices);
            }).catch(error => {
                console.error('Error loading coin prices:', error);
                // Update cards to show N/A for USD values
                updatePoolCardsWithPrices(sortedPools.map(pool => {
                    pool.totalPaidUSD = 0;
                    return pool;
                }));
            });
        })
        .fail(function() {
            $(".pool-coin-grid").html(`
                <div class='alert alert-warning' style='grid-column: 1/-1;'>
                    <h4><i class='fas fa-exclamation-triangle'></i> Warning!</h4>
                    <hr>
                    <p>The pool is currently down for maintenance.</p>
                    <p>Please try again later.</p>
                </div>
            `);
        });
}

// Add touch handlers for mobile
function addTouchHandlers() {
    $('.pool-card').on('touchstart', function() {
        $(this).addClass('touch-active');
    }).on('touchend touchcancel', function() {
        $(this).removeClass('touch-active');
    });
}

// Load coin prices for all pools
function loadAllCoinPrices(pools) {
    return new Promise((resolve) => {
        const pricePromises = pools.map(pool => {
            return new Promise((resolvePrice) => {
                const coinSymbol = getCoinSymbol(pool.coin.type);
                
                // Set timeout for price API calls (3 seconds)
                const timeout = setTimeout(() => {
                    console.log(`Price API timeout for ${coinSymbol}`);
                    pool.coinPrice = 0;
                    pool.totalPaidUSD = 0;
                    resolvePrice(pool);
                }, 3000);
                
                // Helper function to resolve with cleanup
                const resolveWithCleanup = (price = 0) => {
                    clearTimeout(timeout);
                    pool.coinPrice = price;
                    pool.totalPaidUSD = pool.totalPaid * price;
                    resolvePrice(pool);
                };
                
                // Try different price APIs based on coin symbol
                if (coinSymbol === "LOG") {
                    $.ajax({
                        url: "https://api.coingecko.com/api/v3/simple/price?ids=woodcoin&vs_currencies=usd",
                        timeout: 2500,
                        method: 'GET'
                    })
                        .done(function(data) {
                            const price = data.woodcoin?.usd || 0;
                            resolveWithCleanup(price);
                        })
                        .fail(function() {
                            resolveWithCleanup(0);
                        });
                } else {
                    // Try Xeggex API first with coin symbol
                    $.ajax({
                        url: "https://api.xeggex.com/api/v2/market/getbysymbol/" + coinSymbol + "%2FUSDT",
                        timeout: 2500,
                        method: 'GET'
                    })
                        .done(function(data) {
                            const price = data.lastPrice || 0;
                            resolveWithCleanup(price);
                        })
                        .fail(function() {
                            resolveWithCleanup(0);
                        });
                }
            });
        });
        
        // Wait for all price requests to complete (or timeout)
        Promise.all(pricePromises).then(poolsWithPrices => {
            console.log('All coin prices loaded');
            resolve(poolsWithPrices);
        });
    });
}

// Enhanced pool card generator with payment scheme indicator
function generatePoolCard(value) {
    var coinLogo = `<img src='img/coin/icon/${value.coin.type.toLowerCase()}.png' 
                    onerror="this.src='img/coin/icon/default.png'"
                    alt='${value.coin.type}' loading="lazy" />`;
    var coinName = value.coin.canonicalName || value.coin.name || value.coin.type;
    var coinSymbol = getCoinSymbol(value.coin.type);
    
    var pool_networkstat_hash = "Loading...";
    var pool_networkstat_diff = "Loading...";
    var pool_stat_miner = "0";
    var pool_stat_hash = "0 H/s";
    var pool_fee = value.poolFeePercent + "%";
    var pool_total_paid_usd = "Loading...";
    
    if(value.networkStats) {
        pool_networkstat_hash = _formatter(value.networkStats.networkHashrate, 3, "H/s");
        pool_networkstat_diff = _formatter(value.networkStats.networkDifficulty, 6, "");
    }
    
    if(value.poolStats) {
        pool_stat_miner = value.poolStats.connectedMiners;
        pool_stat_hash = _formatter(value.poolStats.poolHashrate, 3, "H/s");
    }
    
    // Format total paid USD
    if (value.totalPaidUSD === "loading") {
        pool_total_paid_usd = '<i class="fas fa-spinner fa-spin"></i>';
    } else if (value.totalPaidUSD !== undefined) {
        if (value.totalPaidUSD > 0) {
            // Format USD values nicely
            if (value.totalPaidUSD >= 1000000) {
                pool_total_paid_usd = "$" + (value.totalPaidUSD / 1000000).toFixed(1) + "M";
            } else if (value.totalPaidUSD >= 1000) {
                pool_total_paid_usd = "$" + (value.totalPaidUSD / 1000).toFixed(1) + "K";
            } else if (value.totalPaidUSD >= 1) {
                pool_total_paid_usd = "$" + value.totalPaidUSD.toFixed(0);
            } else if (value.totalPaidUSD > 0) {
                pool_total_paid_usd = "$" + value.totalPaidUSD.toFixed(2);
            } else {
                pool_total_paid_usd = "$0";
            }
        } else {
            pool_total_paid_usd = "N/A";
        }
    }
    
    var pool_status = value.poolStats && value.poolStats.connectedMiners > 0 ? 
        '<span class="text-success"><i class="fas fa-circle"></i> Online</span>' : 
        '<span class="text-muted"><i class="fas fa-circle"></i> Offline</span>';
    
    // Get payment scheme and style it
    var paymentScheme = value.paymentProcessing.payoutScheme || 'Unknown';
    var schemeClass = 'payment-scheme-badge';
    var schemeIcon = '';
    
    // Add specific styling and icons based on payment scheme
    switch(paymentScheme.toUpperCase()) {
        case 'SOLO':
            schemeClass += ' scheme-solo';
            schemeIcon = '<i class="fas fa-user"></i>';
            break;
        case 'PPLNS':
            schemeClass += ' scheme-pplns';
            schemeIcon = '<i class="fas fa-chart-line"></i>';
            break;
        case 'PROP':
            schemeClass += ' scheme-prop';
            schemeIcon = '<i class="fas fa-percentage"></i>';
            break;
        case 'PPS':
            schemeClass += ' scheme-pps';
            schemeIcon = '<i class="fas fa-coins"></i>';
            break;
        default:
            schemeClass += ' scheme-default';
            schemeIcon = '<i class="fas fa-info-circle"></i>';
    }
    
    // Improved mobile-friendly card layout with payment scheme indicator
    return `
    <a href="#${value.id}/stats" class="pool-card">
        <div class="payment-scheme-indicator">
            <span class="${schemeClass}">
                ${schemeIcon} ${paymentScheme}
            </span>
        </div>
        <div class="pool-card-header">
            <div class="pool-card-icon">
                ${coinLogo}
            </div>
            <div>
                <div class="pool-card-title">${coinName}</div>
                <div class="pool-card-algo">${coinSymbol} • ${value.coin.algorithm}</div>
            </div>
        </div>
        
        <div class="pool-card-stats">
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">Miners</span>
                <span class="pool-card-stat-value">${pool_stat_miner}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'Pool' : 'Pool Rate'}</span>
                <span class="pool-card-stat-value">${pool_stat_hash}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">${isMobile() ? 'Total Paid' : 'Total Paid (USD)'}</span>
                <span class="pool-card-stat-value">${pool_total_paid_usd}</span>
            </div>
            <div class="pool-card-stat">
                <span class="pool-card-stat-label">Fee</span>
                <span class="pool-card-stat-value">${pool_fee}</span>
            </div>
        </div>
        
        <div class="pool-card-status">
            ${pool_status}
        </div>
    </a>`;
}

// Enhanced navigation loader
function loadNavigation() {
    return $.ajax(API + "pools")
        .done(function(data) {
            var coinLogo = "";
            var coinName = "";
            var coinScheme = "";
            
            $.each(data.pools, function(index, value) {
                if (currentPool === value.id) {
                    coinLogo = `<img style='width:40px' src='img/coin/icon/${value.coin.type.toLowerCase()}.png' 
                               onerror="this.src='img/coin/icon/default.png'" />`;
                    coinName = value.coin.canonicalName || value.coin.name || value.coin.type;
                    coinScheme = value.paymentProcessing.payoutScheme;
                }
            });
            
            // Update sidebar
            var sidebarList = $(".sidebar-template").html()
                .replace(/{{ coinId }}/g, currentPool)
                .replace(/{{ coinLogo }}/g, coinLogo)
                .replace(/{{ coinName }}/g, coinName);
            $(".sidebar-wrapper").html(sidebarList);
            
            // Update navigation links
            $(".nav-home").attr("href", "#");
            $(".nav-blocks.pool-nav-link").attr("href", "#" + currentPool + "/blocks");
            $(".nav-payments.pool-nav-link").attr("href", "#" + currentPool + "/payments");
            $(".nav-miners.pool-nav-link").attr("href", "#" + currentPool + "/miners");
        })
        .fail(function() {
            console.error("Failed to load navigation");
        });
}

// Stats Page Loader
function loadStatsPage() {
    console.log('Loading stats page');
    
    // Clear existing intervals
    clearAllIntervals();
    
    // Wait for Chart.js to be ready
    waitForChartJS(() => {
        // Load data immediately
        loadStatsData();
        loadStatsChart('24h');
        
        // Set up intervals for updates
        const dataInterval = setInterval(loadStatsData, 60000);
        const chartInterval = setInterval(() => loadStatsChart('24h'), 60000);
        addInterval(dataInterval);
        addInterval(chartInterval);
    });
}

// Enhanced Stats Data Loader
function loadStatsData() {
    console.log('Loading stats data...');
    
    return $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) {
                console.error("Pool not found:", currentPool);
                return;
            }
            
            // Update all stats with animations
            updateStat("#blockchainHeight", pool.networkStats.blockHeight.toLocaleString());
            updateStat("#poolFeePercent", `${pool.poolFeePercent}%`);
            updateStat("#poolHashRate", _formatter(pool.poolStats.poolHashrate, 2, "H/s"));
            updateStat("#poolMiners", `${pool.poolStats.connectedMiners} Miner(s)`);
            updateStat("#networkHashRate", _formatter(pool.networkStats.networkHashrate, 2, "H/s"));
            updateStat("#networkDifficulty", _formatter(pool.networkStats.networkDifficulty, 5, ""));
            
            // Load additional block data
            loadBlockStats(pool);
        })
        .fail(function() {
            console.error("Failed to load stats data");
            showNotification("Failed to load stats data", "danger");
        });
}

// Helper function to update stats with animation
function updateStat(selector, value) {
    var element = $(selector);
    if (element.text() !== value) {
        element.fadeOut(200, function() {
            $(this).text(value).fadeIn(200);
        });
    }
}

// Load block statistics
function loadBlockStats(pool) {
    $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=100")
        .done(function(blocks) {
            var confirmedCount = blocks.filter(b => b.status === "confirmed" || b.status === "orphaned").length;
            var pendingCount = blocks.filter(b => b.status === "pending").length;
            
            $("#nav-blocks-badge").text(confirmedCount + pendingCount);
            
            // Calculate average effort
            var effortSum = 0;
            var effortCount = 0;
            blocks.forEach(block => {
                if (block.effort !== undefined) {
                    effortSum += block.effort * 100;
                    effortCount++;
                }
            });
            
            if (effortCount > 0) {
                var avgEffort = (effortSum / effortCount).toFixed(2);
                $("#poolEffort").html(`
                    <div>Current: ${(pool.poolEffort * 100).toFixed(2)}%</div>
                    <div class="text-muted">Average: ${avgEffort}%</div>
                `);
            }
        });
}

// Simple test to verify API structure
function testAPIStructure() {
    console.log('Testing API structure...');
    
    // Test pools endpoint
    $.ajax(API + "pools")
        .done(function(data) {
            console.log('Pools API response:', data);
            if (data.pools && data.pools.length > 0) {
                const firstPool = data.pools[0];
                console.log('First pool ID:', firstPool.id);
                
                // Test performance endpoint
                $.ajax(API + "pools/" + firstPool.id + "/performance?page=0&pageSize=10")
                    .done(function(perfData) {
                        console.log('Performance API response:', perfData);
                        console.log('Performance data structure:', {
                            isArray: Array.isArray(perfData),
                            hasStats: perfData.stats !== undefined,
                            firstItem: perfData.stats ? perfData.stats[0] : perfData[0]
                        });
                    })
                    .fail(function(xhr) {
                        console.error('Performance API failed:', xhr);
                    });
            }
        })
        .fail(function(xhr) {
            console.error('Pools API failed:', xhr);
        });
}

// Enhanced Stats Chart with better error handling and API structure detection
function loadStatsChart(timeframe = '24h') {
    console.log('Loading stats chart with timeframe:', timeframe);
    
    const endDate = new Date();
    let pageSize = 48; // Default for 24h (30 min intervals)
    
    switch(timeframe) {
        case '7d':
            pageSize = 336; // 7 days of 30 min intervals
            break;
        case '30d':
            pageSize = 1440; // 30 days of 30 min intervals
            break;
    }
    
    return $.ajax(API + "pools/" + currentPool + "/performance?page=0&pageSize=" + pageSize)
        .done(function(rawData) {
            console.log('Stats chart data received:', rawData);
            
            const colors = getThemeColors();
            const ctx = document.getElementById('chartStatsHashRatePool');
            if (!ctx) {
                console.error('Chart canvas element not found');
                return;
            }
            
            // Detect API response structure
            let data;
            if (rawData.stats && Array.isArray(rawData.stats)) {
                // Response has stats property
                data = rawData.stats;
            } else if (Array.isArray(rawData)) {
                // Response is directly an array
                data = rawData;
            } else {
                console.error('Unknown API response structure:', rawData);
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Invalid data format</p></div>';
                return;
            }
            
            // Check if we have valid data
            if (!data || data.length === 0) {
                console.warn('No stats data available');
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-info-circle"></i><p>No data available</p></div>';
                return;
            }
            
            console.log('Processing', data.length, 'data points');
            
            // Process data
            const labels = [];
            const poolHashRate = [];
            const networkHashRate = [];
            const connectedMiners = [];
            
            // Calculate skip rate based on timeframe and device
            let skipRate = 1;
            if (timeframe === '7d') skipRate = isMobile() ? 8 : 4;
            if (timeframe === '30d') skipRate = isMobile() ? 32 : 16;
            
            // Reverse the data array to show oldest to newest
            const reversedData = data.slice().reverse();
            
            reversedData.forEach((value, index) => {
                if (index % skipRate === 0 && value) {
                    const date = new Date(value.created);
                    if (!isNaN(date.getTime())) {
                        labels.push(date);
                        poolHashRate.push(value.poolHashrate || value.poolHashRate || 0);
                        networkHashRate.push(value.networkHashrate || value.networkHashRate || 0);
                        connectedMiners.push(value.connectedMiners || 0);
                    }
                }
            });
            
            console.log('Processed chart data:', {
                labels: labels.length,
                poolHashRate: poolHashRate.length,
                networkHashRate: networkHashRate.length,
                hasData: poolHashRate.some(v => v > 0)
            });
            
            // If no valid data points, show message
            if (labels.length === 0) {
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-info-circle"></i><p>No valid data points found</p></div>';
                return;
            }
            
            // Calculate statistics
            const currentPoolRate = poolHashRate[poolHashRate.length - 1] || 0;
            const previousPoolRate = poolHashRate[poolHashRate.length - 2] || currentPoolRate;
            const poolRateChange = previousPoolRate > 0 ? ((currentPoolRate - previousPoolRate) / previousPoolRate * 100).toFixed(1) : 0;
            
            const currentNetworkRate = networkHashRate[networkHashRate.length - 1] || 0;
            const currentMinersCount = connectedMiners[connectedMiners.length - 1] || 0;
            const previousMinersCount = connectedMiners[connectedMiners.length - 2] || currentMinersCount;
            const minersChange = currentMinersCount - previousMinersCount;
            
            const poolShare = currentNetworkRate > 0 ? (currentPoolRate / currentNetworkRate * 100).toFixed(2) : 0;
            
            // Update statistics panel
            $("#currentPoolRate").text(_formatter(currentPoolRate, 2, "H/s"));
            $("#poolRateChange").text((poolRateChange >= 0 ? '+' : '') + poolRateChange + '%')
                .removeClass('positive negative')
                .addClass(poolRateChange >= 0 ? 'positive' : 'negative');
            
            $("#currentNetworkRate").text(_formatter(currentNetworkRate, 2, "H/s"));
            $("#currentMiners").text(currentMinersCount);
            $("#minersChange").text((minersChange >= 0 ? '+' : '') + minersChange)
                .removeClass('positive negative')
                .addClass(minersChange >= 0 ? 'positive' : 'negative');
            
            $("#poolShare").text(poolShare + '%');
            
            // Destroy existing chart
            if (window.chartInstances.statsChart) {
                window.chartInstances.statsChart.destroy();
            }
            
            // Create new chart
            try {
                window.chartInstances.statsChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Pool Hashrate',
                            data: poolHashRate,
                            borderColor: colors.primary,
                            backgroundColor: createGradient(ctx.getContext('2d'), 
                                colors.primary + '40', 
                                colors.primary + '05'),
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointBackgroundColor: colors.primary,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y'
                        }, {
                            label: 'Network Hashrate',
                            data: networkHashRate,
                            borderColor: colors.success,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointBackgroundColor: colors.success,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y'
                        }, {
                            label: 'Active Miners',
                            data: connectedMiners,
                            borderColor: colors.warning,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointBackgroundColor: colors.warning,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y1',
                            hidden: isMobile() // Hide on mobile by default
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: {
                                display: false // Using custom legend
                            },
                            tooltip: {
                                enabled: true,
                                backgroundColor: colors.tooltipBg,
                                titleColor: colors.textPrimary,
                                bodyColor: colors.textSecondary,
                                borderColor: colors.borderColor,
                                borderWidth: 1,
                                padding: 12,
                                displayColors: true,
                                callbacks: {
                                    title: function(context) {
                                        const date = new Date(context[0].parsed.x);
                                        return date.toLocaleString();
                                    },
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            if (context.datasetIndex === 2) {
                                                label += context.parsed.y + ' miners';
                                            } else {
                                                label += _formatter(context.parsed.y, 2, "H/s");
                                            }
                                        }
                                        return label;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    displayFormats: {
                                        hour: 'HH:mm',
                                        day: 'MMM dd',
                                        week: 'MMM dd',
                                        month: 'MMM yyyy'
                                    }
                                },
                                ticks: {
                                    color: colors.textSecondary,
                                    maxTicksLimit: isMobile() ? 6 : 12,
                                    autoSkip: true
                                },
                                grid: {
                                    color: colors.gridColor,
                                    drawBorder: false
                                }
                            },
                            y: {
                                type: 'linear',
                                position: 'left',
                                beginAtZero: true,
                                ticks: {
                                    color: colors.textSecondary,
                                    callback: function(value) {
                                        return _formatter(value, 1, "");
                                    }
                                },
                                grid: {
                                    color: colors.gridColor,
                                    drawBorder: false
                                }
                            },
                            y1: {
                                type: 'linear',
                                position: 'right',
                                beginAtZero: true,
                                ticks: {
                                    color: colors.textSecondary,
                                    callback: function(value) {
                                        return Math.round(value);
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
                
                console.log('Stats chart created successfully');
            } catch (error) {
                console.error('Error creating stats chart:', error);
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Error creating chart</p></div>';
            }
        })
        .fail(function(xhr, status, error) {
            console.error("Failed to load stats chart data:", status, error);
            const ctx = document.getElementById('chartStatsHashRatePool');
            if (ctx) {
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Failed to load chart data</p></div>';
            }
        });
}

// Dashboard Page Loader
function loadDashboardPage() {
    console.log('Loading dashboard page');
    
    // Clear existing intervals
    clearAllIntervals();
    
    // Wait for Chart.js to be ready
    waitForChartJS(() => {
        // Check for wallet in URL or localStorage
        var walletQueryString = window.location.hash.split(/[#/?]/)[3];
        if (walletQueryString) {
            var wallet = walletQueryString.replace("address=", "");
            if (wallet) {
                $("#walletAddress").val(wallet);
                localStorage.setItem(currentPool + "-walletAddress", wallet);
                window.currentDashboardAddress = wallet;
                loadDashboardData(wallet);
            }
        } else if (localStorage[currentPool + "-walletAddress"]) {
            $("#walletAddress").val(localStorage[currentPool + "-walletAddress"]);
            window.currentDashboardAddress = localStorage[currentPool + "-walletAddress"];
            loadDashboardData(localStorage[currentPool + "-walletAddress"]);
        }
    });
}

// Load wallet stats with proper error handling
function loadWallet() {
    var walletAddress = $("#walletAddress").val().trim();
    
    if (!walletAddress) {
        showNotification("Please enter a wallet address", "warning");
        return false;
    }
    
    console.log('Loading wallet:', walletAddress);
    localStorage.setItem(currentPool + "-walletAddress", walletAddress);
    window.currentDashboardAddress = walletAddress;
    
    // Update URL without triggering navigation
    if (history.pushState) {
        history.pushState(null, null, "#" + currentPool + "/dashboard?address=" + walletAddress);
    } else {
        window.location.hash = currentPool + "/dashboard?address=" + walletAddress;
    }
    
    // Load all dashboard data
    loadDashboardData(walletAddress);
    
    // Prevent form submission
    return false;
}

// Enhanced Dashboard Data Loader - Mobile optimized
function loadDashboardData(walletAddress) {
    if (!walletAddress) return;
    
    console.log('Loading dashboard data for:', walletAddress);
    
    // Show loading state
    $(".stat-value").html('<i class="fas fa-spinner fa-spin"></i>');
    $(".pending-info-value").html('<i class="fas fa-spinner fa-spin"></i>');
    
    // Load miner data
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress)
        .done(function(data) {
            // Update pending info (shares and balance separately)
            $("#pendingShares").text(_formatter(data.pendingShares || 0, 0, ""));
            $("#pendingBalance").text(_formatter(data.pendingBalance || 0, 8, ""));
            
            // Update other balance information
            $("#pendingBalance2").text(_formatter(data.pendingBalance || 0, 8, ""));
            $("#totalPaid").text(_formatter(data.totalPaid || 0, 8, ""));
            
            // Calculate worker stats
            var workerCount = 0;
            var totalHashrate = 0;
            
            if (data.performance && data.performance.workers) {
                $.each(data.performance.workers, function(workerId, worker) {
                    workerCount++;
                    totalHashrate += worker.hashrate;
                });
            }
            
            // Update worker stats
            $("#workersOnline").text(workerCount);
            $("#workers-badge").text(workerCount);
            $("#hashrate30m").text(_formatter(totalHashrate, 3, "H/s"));
            $("#hashrate3h").text(_formatter(totalHashrate * 0.95, 3, "H/s")); // Approximation
            
            // Update last share time
            if (data.lastPaymentLink) {
                $("#lastShareSubmitted").text("Recently");
            } else {
                $("#lastShareSubmitted").text("never");
            }
            
            // Load additional data
            loadDashboardWorkerList(walletAddress);
            loadDashboardChart(walletAddress, '24h');
            loadPaymentsMinerPage(walletAddress);
            loadBlocksMinerPage(walletAddress);
            loadEarningsMinerPage(walletAddress);
            
            // Calculate additional stats
            calculateMinerStats(data, walletAddress);
            
            // Set up auto-refresh
            const refreshInterval = setInterval(() => {
                if (currentPage === 'dashboard' && $("#walletAddress").val() === walletAddress) {
                    loadDashboardData(walletAddress);
                }
            }, 60000);
            addInterval(refreshInterval);
        })
        .fail(function(xhr) {
            console.error("Failed to load dashboard data:", xhr);
            showNotification("Miner not found or no data available", "danger");
            
            // Reset values
            $(".stat-value").text("0");
            $(".pending-info-value").text("0");
            $("#lastShareSubmitted").text("never");
        });
}

// Calculate additional miner statistics
function calculateMinerStats(minerData, walletAddress) {
    // Get pool data for calculations
    $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) return;
            
            // Calculate round share percentage
            if (pool.poolStats.poolHashrate > 0 && minerData.performance) {
                var minerHashrate = 0;
                $.each(minerData.performance.workers, function(id, worker) {
                    minerHashrate += worker.hashrate;
                });
                
                var sharePercent = (minerHashrate / pool.poolStats.poolHashrate) * 100;
                $("#roundShare").text(sharePercent.toFixed(6) + "%");
            }
            
            // Update pool effort
            if (pool.poolEffort !== undefined) {
                $("#poolEffort").text((pool.poolEffort * 100).toFixed(2) + "%");
            }
        });
}

// Enhanced Worker List Display - Mobile optimized
function loadDashboardWorkerList(walletAddress) {
    console.log('Loading worker list...');
    
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress)
        .done(function(data) {
            var workerList = "";
            
            if (data.performance && data.performance.workers) {
                $.each(data.performance.workers, function(workerId, worker) {
                    var isOffline = worker.hashrate === 0;
                    var rowClass = isOffline ? "table-danger" : "";
                    var lastShare = isOffline ? "offline" : "active";
                    var displayWorkerId = workerId || 'default';
                    
                    // Truncate worker ID for mobile
                    if (isMobile() && displayWorkerId.length > 15) {
                        displayWorkerId = displayWorkerId.substring(0, 12) + '...';
                    }
                    
                    workerList += `
                    <tr class="${rowClass}">
                        <td data-label="Worker ID"><i class="fas fa-desktop"></i> ${displayWorkerId}</td>
                        <td data-label="Hashrate (30m)">${_formatter(worker.hashrate, 3, "H/s")}</td>
                        <td data-label="Hashrate (3h)">${_formatter(worker.hashrate * 0.95, 3, "H/s")}</td>
                        <td data-label="Last Share" class="${isOffline ? 'text-danger' : 'text-success'}">${lastShare}</td>
                    </tr>`;
                });
            } else {
                workerList = '<tr><td colspan="4" class="text-center text-muted">No workers found</td></tr>';
            }
            
            $("#workerList").html(workerList);
        })
        .fail(function() {
            $("#workerList").html('<tr><td colspan="4" class="text-center text-danger">Failed to load workers</td></tr>');
        });
}

// Enhanced Dashboard Chart with Chart.js - Modern real-time hashrate chart
function loadDashboardChart(walletAddress, timeframe = '24h') {
    console.log('Loading dashboard chart for wallet:', walletAddress, 'timeframe:', timeframe);
    
    if (!walletAddress) {
        console.error('No wallet address provided');
        return;
    }
    
    let pageSize = 48; // Default for 24h
    
    switch(timeframe) {
        case '7d':
            pageSize = 336;
            break;
        case '30d':
            pageSize = 720;
            break;
    }
    
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/performance?page=0&pageSize=" + pageSize)
        .done(function(data) {
            console.log('Dashboard chart data received:', data);
            
            const colors = getThemeColors();
            const ctx = document.getElementById('chartDashboardHashRate');
            if (!ctx) {
                console.error('Dashboard chart canvas element not found');
                return;
            }
            
            // Check if we have valid data
            if (!data || data.length === 0) {
                console.warn('No performance data available');
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>No data available</p></div>';
                return;
            }
            
            // Process data
            const labels = [];
            const minerHashRate = [];
            const workerData = {};
            
            // Calculate skip rate based on timeframe
            let skipRate = 1;
            if (timeframe === '7d') skipRate = isMobile() ? 8 : 4;
            if (timeframe === '30d') skipRate = isMobile() ? 16 : 8;
            
            // Reverse the data array to show oldest to newest
            const reversedData = data.slice().reverse();
            
            reversedData.forEach((value, index) => {
                if (index % skipRate === 0) {
                    const date = new Date(value.created);
                    labels.push(date);
                    
                    let totalHashRate = 0;
                    let activeWorkers = 0;
                    
                    if (value.workers) {
                        $.each(value.workers, function(workerId, worker) {
                            const workerHashrate = worker.hashrate || 0;
                            totalHashRate += workerHashrate;
                            if (workerHashrate > 0) activeWorkers++;
                            
                            // Track individual worker data
                            if (!workerData[workerId]) {
                                workerData[workerId] = [];
                            }
                            workerData[workerId].push(workerHashrate);
                        });
                    }
                    
                    minerHashRate.push(totalHashRate);
                }
            });
            
            console.log('Processed dashboard chart data:', {
                labels: labels.length,
                minerHashRate: minerHashRate.length,
                workers: Object.keys(workerData).length
            });
            
            // Calculate statistics
            const currentHashrate = minerHashRate[minerHashRate.length - 1] || 0;
            const avgHashrate = minerHashRate.reduce((a, b) => a + b, 0) / minerHashRate.length || 0;
            const peakHashrate = Math.max(...minerHashRate) || 0;
            const activeWorkers = Object.keys(workerData).filter(w => {
                const lastValue = workerData[w][workerData[w].length - 1];
                return lastValue > 0;
            }).length;
            
            // Calculate hashrate change
            const previousHashrate = minerHashRate[minerHashRate.length - 2] || currentHashrate;
            const hashrateChange = previousHashrate > 0 ? ((currentHashrate - previousHashrate) / previousHashrate * 100).toFixed(1) : 0;
            
            // Update statistics panel
            $("#currentHashrateStat").text(_formatter(currentHashrate, 3, "H/s"));
            $("#avgHashrateStat").text(_formatter(avgHashrate, 3, "H/s"));
            $("#peakHashrateStat").text(_formatter(peakHashrate, 3, "H/s"));
            $("#activeWorkersStat").text(activeWorkers);
            $("#hashrateChange").text((hashrateChange >= 0 ? '+' : '') + hashrateChange + '%')
                .removeClass('positive negative')
                .addClass(hashrateChange >= 0 ? 'positive' : 'negative');
            
            // Destroy existing chart
            if (window.chartInstances.dashboardChart) {
                window.chartInstances.dashboardChart.destroy();
            }
            
            // Create gradient
            const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.height);
            gradient.addColorStop(0, colors.primary + '40');
            gradient.addColorStop(1, colors.primary + '05');
            
            // Create new chart
            try {
                window.chartInstances.dashboardChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Hashrate',
                            data: minerHashRate,
                            borderColor: colors.primary,
                            backgroundColor: gradient,
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointBackgroundColor: colors.primary,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointHoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        animation: {
                            duration: 750,
                            easing: 'easeInOutQuart'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: true,
                                backgroundColor: colors.tooltipBg,
                                titleColor: colors.textPrimary,
                                bodyColor: colors.textSecondary,
                                borderColor: colors.borderColor,
                                borderWidth: 1,
                                padding: 12,
                                displayColors: false,
                                callbacks: {
                                    title: function(context) {
                                        const date = new Date(context[0].parsed.x);
                                        return date.toLocaleString();
                                    },
                                    label: function(context) {
                                        return 'Hashrate: ' + _formatter(context.parsed.y, 3, "H/s");
                                    },
                                    afterLabel: function(context) {
                                        const index = context.dataIndex;
                                        const activeCount = Object.keys(workerData).filter(w => {
                                            return workerData[w][index] > 0;
                                        }).length;
                                        return 'Active Workers: ' + activeCount;
                                    }
                                }
                            },
                            zoom: {
                                pan: {
                                    enabled: !isMobile(),
                                    mode: 'x'
                                },
                                zoom: {
                                    wheel: {
                                        enabled: !isMobile()
                                    },
                                    pinch: {
                                        enabled: true
                                    },
                                    mode: 'x'
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    displayFormats: {
                                        hour: 'HH:mm',
                                        day: 'MMM dd',
                                        week: 'MMM dd'
                                    }
                                },
                                ticks: {
                                    color: colors.textSecondary,
                                    maxTicksLimit: isMobile() ? 6 : 12,
                                    autoSkip: true
                                },
                                grid: {
                                    color: colors.gridColor,
                                    drawBorder: false
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: colors.textSecondary,
                                    callback: function(value) {
                                        return _formatter(value, 1, "");
                                    }
                                },
                                grid: {
                                    color: colors.gridColor,
                                    drawBorder: false
                                }
                            }
                        }
                    }
                });
                
                console.log('Dashboard chart created successfully');
            } catch (error) {
                console.error('Error creating dashboard chart:', error);
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Error creating chart</p></div>';
            }
        })
        .fail(function(xhr, status, error) {
            console.error("Failed to load dashboard chart:", status, error);
            // Show error message in chart area
            const ctx = document.getElementById('chartDashboardHashRate');
            if (ctx) {
                ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Failed to load chart data</p></div>';
            }
        });
}

// Enhanced Load Miner Payments with Payment Statistics
function loadPaymentsMinerPage(walletAddress) {
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/payments?page=0&pageSize=500")
        .done(function(data) {
            var payoutsList = "";
            
            // Calculate payment statistics
            calculatePaymentStatistics(data);
            
            if (data.length > 0) {
                // Show only the first 50 payments in the table
                var displayPayments = data.slice(0, 50);
                
                $.each(displayPayments, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    
                    // Mobile-friendly address truncation
                    var displayAddress = isMobile() 
                        ? value.address.substring(0, 8) + '...' + value.address.substring(value.address.length - 8)
                        : value.address.substring(0, 12) + '...' + value.address.substring(value.address.length - 12);
                    
                    payoutsList += `
                    <tr>
                        <td data-label="Time">${isMobile() ? timeAgo : createDate.toLocaleString()}</td>
                        <td data-label="Amount">${_formatter(value.amount, 8, "")}</td>
                        <td data-label="Address">${displayAddress}</td>
                        <td data-label="Transaction"><a href="${value.transactionInfoLink}" target="_blank">
                            ${value.transactionConfirmationData.substring(0, isMobile() ? 8 : 16)}...
                        </a></td>
                    </tr>`;
                });
            } else {
                payoutsList = '<tr><td colspan="4" class="text-center text-muted">No payouts yet</td></tr>';
            }
            
            $("#payoutsList").html(payoutsList);
        })
        .fail(function() {
            $("#payoutsList").html('<tr><td colspan="4" class="text-center text-danger">Failed to load payments</td></tr>');
            // Reset payment statistics
            $("#todayPaymentTotal").text("0.00000000");
            $("#yesterdayPaymentTotal").text("0.00000000");
            $("#averagePayment7Days").text("0.00000000");
        });
}

// Calculate Payment Statistics
function calculatePaymentStatistics(payments) {
    if (!payments || payments.length === 0) {
        $("#todayPaymentTotal").text("0.00000000");
        $("#yesterdayPaymentTotal").text("0.00000000");
        $("#averagePayment7Days").text("0.00000000");
        return;
    }
    
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    var yesterdayEnd = new Date(todayStart);
    var sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    var todayTotal = 0;
    var yesterdayTotal = 0;
    var sevenDayTotal = 0;
    var dailyTotals = {};
    
    // Initialize daily totals for the last 7 days
    for (let i = 0; i < 7; i++) {
        let date = new Date(todayStart);
        date.setDate(date.getDate() - i);
        let dateKey = date.toDateString();
        dailyTotals[dateKey] = 0;
    }
    
    // Calculate totals
    payments.forEach(function(payment) {
        var paymentDate = new Date(payment.created);
        var paymentDateKey = paymentDate.toDateString();
        var amount = parseFloat(payment.amount);
        
        // Today's total
        if (paymentDate >= todayStart) {
            todayTotal += amount;
        }
        
        // Yesterday's total
        if (paymentDate >= yesterdayStart && paymentDate < yesterdayEnd) {
            yesterdayTotal += amount;
        }
        
        // 7-day total
        if (paymentDate >= sevenDaysAgo) {
            sevenDayTotal += amount;
            if (dailyTotals.hasOwnProperty(paymentDateKey)) {
                dailyTotals[paymentDateKey] += amount;
            }
        }
    });
    
    // Calculate 7-day average
    var sevenDayAverage = sevenDayTotal / 7;
    
    // Update the display
    $("#todayPaymentTotal").text(_formatter(todayTotal, 8, ""));
    $("#yesterdayPaymentTotal").text(_formatter(yesterdayTotal, 8, ""));
    $("#averagePayment7Days").text(_formatter(sevenDayAverage, 8, ""));
}

// Load Miner Blocks
function loadBlocksMinerPage(walletAddress) {
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/blocks?page=0&pageSize=50")
        .done(function(data) {
            var blockList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    var effort = Math.round(value.effort * 100);
                    var minerEffort = Math.round(value.minerEffort * 100);
                    var effortClass = effort < 100 ? "text-success" : effort < 200 ? "text-warning" : "text-danger";
                    var minerEffortClass = minerEffort < 100 ? "text-success" : minerEffort < 200 ? "text-warning" : "text-danger";
                    
                    var progressValue = value.confirmationProgress ? Math.round(value.confirmationProgress * 100) : 0;
                    
                    blockList += `
                    <tr>
                        <td>${timeAgo}</td>
                        <td><a href="${value.infoLink}" target="_blank">${value.blockHeight}</a></td>
                        <td class="${effortClass}">${effort}%</td>
                        <td class="${minerEffortClass}">${minerEffort}%</td>
                        <td>${_formatter(value.reward, 5, "")}</td>
                        <td>${value.type === "uncle" ? "Uncle" : "Block"}</td>
                        <td>${value.status}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" role="progressbar" style="width: ${progressValue}%">
                                    ${progressValue}%
                                </div>
                            </div>
                        </td>
                    </tr>`;
                });
            } else {
                blockList = '<tr><td colspan="8" class="text-center text-muted">No blocks found yet</td></tr>';
            }
            
            $("#DashboardBlockList").html(blockList);
        })
        .fail(function() {
            $("#DashboardBlockList").html('<tr><td colspan="8" class="text-center text-danger">Failed to load blocks</td></tr>');
        });
}

// Load Miner Earnings with Daily Payment History
function loadEarningsMinerPage(walletAddress) {
    // First, load the balance changes for transaction history
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/balancechanges?page=0&pageSize=999")
        .done(function(data) {
            var earningsList = "";
            
            if (data.length > 0) {
                // Show last 30 transactions
                $.each(data, function(index, value) {
                    if (index >= 30) return false; // Limit to 30 items
                    
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var description = value.amount > 0 ? value.usage : 
                        (value.usage === "Balance expired" ? "Balance expired" : 
                        `Payment sent${isMobile() ? '' : ' to ' + value.address.substring(0, 8) + '...'}`);
                    var amountClass = value.amount > 0 ? "text-success" : "text-danger";
                    var amountStr = (value.amount < 0 ? "" : "+") + value.amount.toFixed(6);
                    
                    earningsList += `
                    <tr>
                        <td data-label="Date">${createDate.toLocaleDateString()}</td>
                        <td data-label="Description">${description}</td>
                        <td data-label="Amount" class="${amountClass}">${amountStr}</td>
                    </tr>`;
                });
            } else {
                earningsList = '<tr><td colspan="3" class="text-center text-muted">No balance changes yet</td></tr>';
            }
            
            $("#EarningsList").html(earningsList);
        })
        .fail(function() {
            $("#EarningsList").html('<tr><td colspan="3" class="text-center text-danger">Failed to load balance changes</td></tr>');
        });
    
    // Load daily payment history with enhanced chart
    loadDailyPaymentHistory(walletAddress);
}

// Enhanced Daily Payment History with Chart.js
function loadDailyPaymentHistory(walletAddress) {
    console.log('Loading daily payment history for:', walletAddress);
    
    $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/payments?page=0&pageSize=999")
        .done(function(payments) {
            console.log('Loaded payments:', payments.length);
            
            // Store data globally for timeframe updates
            window.dailyPaymentChartData = payments;
            
            // Create daily totals object
            var dailyTotals = {};
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Initialize last 30 days with zero
            for (let i = 0; i < 30; i++) {
                let date = new Date(today);
                date.setDate(date.getDate() - i);
                let dateKey = formatDateKey(date);
                dailyTotals[dateKey] = 0;
            }
            
            // Process payments and group by date
            payments.forEach(function(payment) {
                try {
                    var paymentDate = new Date(payment.created);
                    if (isNaN(paymentDate.getTime())) {
                        console.warn('Invalid payment date:', payment.created);
                        return;
                    }
                    
                    var dateKey = formatDateKey(paymentDate);
                    var amount = parseFloat(payment.amount) || 0;
                    
                    if (dailyTotals.hasOwnProperty(dateKey)) {
                        dailyTotals[dateKey] += amount;
                    }
                } catch (error) {
                    console.error('Error processing payment:', payment, error);
                }
            });
            
            // Process data for display
            var chartLabels = [];
            var chartData = [];
            var dailyPaymentList = "";
            var totalPaid30Days = 0;
            var daysWithPayments = 0;
            
            // Sort dates and prepare display (newest first)
            var sortedDates = Object.keys(dailyTotals).sort().reverse();
            
            sortedDates.forEach(function(dateKey, index) {
                var amount = dailyTotals[dateKey];
                var date = parseDate(dateKey);
                var displayDate = date.toLocaleDateString();
                var dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                
                totalPaid30Days += amount;
                if (amount > 0) daysWithPayments++;
                
                // Add to chart data (last 14 days only, reverse order for proper chart display)
                if (index < 14) {
                    chartLabels.unshift(isMobile() ? date.getDate().toString() : dayOfWeek);
                    chartData.unshift(amount);
                }
                
                // Add to table
                var amountClass = amount > 0 ? "text-success" : "text-muted";
                var rowClass = amount > 0 ? "" : "table-secondary";
                
                dailyPaymentList += `
                <tr class="${rowClass}">
                    <td data-label="Date">${displayDate}</td>
                    <td data-label="Day">${dayOfWeek}</td>
                    <td data-label="Amount" class="${amountClass}">${_formatter(amount, 8, "")}</td>
                    <td data-label="Status">${amount > 0 ? '<span class="text-success">Paid</span>' : '<span class="text-muted">No Payment</span>'}</td>
                </tr>`;
            });
            
            // Update the daily payment history table
            $("#DailyPaymentList").html(dailyPaymentList);
            
            // Update summary statistics
            var averageDaily = daysWithPayments > 0 ? totalPaid30Days / daysWithPayments : 0;
            $("#total30Days").text(_formatter(totalPaid30Days, 8, ""));
            $("#average30Days").text(_formatter(averageDaily, 8, ""));
            $("#daysWithPayments").text(daysWithPayments);
            
            // Create daily payment chart
            createDailyPaymentChart(chartLabels, chartData);
        })
        .fail(function(xhr, status, error) {
            console.error('Failed to load daily payment history:', status, error);
            $("#DailyPaymentList").html('<tr><td colspan="4" class="text-center text-danger">Failed to load daily payment history</td></tr>');
            $("#total30Days").text("0.00000000");
            $("#average30Days").text("0.00000000");
            $("#daysWithPayments").text("0");
        });
}

// Create daily payment chart with Chart.js
function createDailyPaymentChart(labels, data) {
    console.log('Creating daily payment chart with:', labels.length, 'labels');
    
    const colors = getThemeColors();
    const ctx = document.getElementById('chartDailyPayments');
    if (!ctx) {
        console.error('Daily payment chart canvas element not found');
        return;
    }
    
    // Check if we have valid data
    if (!labels || labels.length === 0 || !data || data.length === 0) {
        console.warn('No payment data available for chart');
        ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-info-circle"></i><p>No payment data available</p></div>';
        return;
    }
    
    // Destroy existing chart
    if (window.chartInstances.dailyPaymentChart) {
        window.chartInstances.dailyPaymentChart.destroy();
    }
    
    // Create gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.height);
    gradient.addColorStop(0, colors.success + '80');
    gradient.addColorStop(1, colors.success + '20');
    
    // Create new chart
    try {
        window.chartInstances.dailyPaymentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Payment',
                    data: data,
                    backgroundColor: gradient,
                    borderColor: colors.success,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.textPrimary,
                        bodyColor: colors.textSecondary,
                        borderColor: colors.borderColor,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return 'Payment: ' + _formatter(context.parsed.y, 8, "");
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: colors.textSecondary,
                            maxRotation: 0
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return _formatter(value, 2, "");
                            }
                        },
                        grid: {
                            color: colors.gridColor,
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('Daily payment chart created successfully');
    } catch (error) {
        console.error('Error creating daily payment chart:', error);
        ctx.parentElement.innerHTML = '<div class="chart-loading"><i class="fas fa-exclamation-triangle"></i><p>Error creating chart</p></div>';
    }
}

// Update daily payment chart timeframe
function updateDailyPaymentChart(payments, days) {
    if (!payments) return;
    
    // Create daily totals object
    var dailyTotals = {};
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize days with zero
    for (let i = 0; i < days; i++) {
        let date = new Date(today);
        date.setDate(date.getDate() - i);
        let dateKey = formatDateKey(date);
        dailyTotals[dateKey] = 0;
    }
    
    // Process payments
    payments.forEach(function(payment) {
        var paymentDate = new Date(payment.created);
        var dateKey = formatDateKey(paymentDate);
        var amount = parseFloat(payment.amount) || 0;
        
        if (dailyTotals.hasOwnProperty(dateKey)) {
            dailyTotals[dateKey] += amount;
        }
    });
    
    // Prepare chart data
    var chartLabels = [];
    var chartData = [];
    var sortedDates = Object.keys(dailyTotals).sort();
    
    sortedDates.forEach(function(dateKey) {
        var amount = dailyTotals[dateKey];
        var date = parseDate(dateKey);
        var label = days <= 14 
            ? (isMobile() ? date.getDate().toString() : date.toLocaleDateString('en-US', { weekday: 'short' }))
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        chartLabels.push(label);
        chartData.push(amount);
    });
    
    // Update chart
    if (window.chartInstances.dailyPaymentChart) {
        window.chartInstances.dailyPaymentChart.data.labels = chartLabels;
        window.chartInstances.dailyPaymentChart.data.datasets[0].data = chartData;
        window.chartInstances.dailyPaymentChart.update();
    }
}

// Helper functions for date handling
function formatDateKey(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
}

function parseDate(dateKey) {
    var parts = dateKey.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// Load Miners Page - Mobile optimized
function loadMinersPage() {
    console.log('Loading miners page');
    
    return $.ajax(API + "pools/" + currentPool + "/miners?page=0&pagesize=20")
        .done(function(data) {
            var minerList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    // Mobile-friendly address display
                    var displayAddress = isMobile() 
                        ? value.miner.substring(0, 8) + '...' + value.miner.substring(value.miner.length - 8)
                        : value.miner;
                    
                    minerList += `
                    <tr>
                        <td data-label="Address">
                            <a href="#${currentPool}/dashboard?address=${value.miner}" class="text-info">
                                <i class="fas fa-user"></i> ${displayAddress}
                            </a>
                        </td>
                        <td data-label="Hashrate">${_formatter(value.hashrate, 2, "H/s")}</td>
                        <td data-label="Share Rate">${_formatter(value.sharesPerSecond, 2, "S/s")}</td>
                    </tr>`;
                });
            } else {
                minerList = '<tr><td colspan="3" class="text-center text-muted">No miners connected</td></tr>';
            }
            
            $("#minerList").html(minerList);
        })
        .fail(function() {
            showNotification("Failed to load miners list", "danger");
        });
}

// Load Blocks Effort Table
async function loadBlocksEffortTable() {
    console.log("Loading blocks effort table");
    try {
        const data = await $.ajax(API + "pools");
        const poolsResponse = data.pools.find(pool => currentPool === pool.id);
        if (!poolsResponse) {
            throw new Error("Pool not found");
        }
        
        var totalBlocks = poolsResponse.totalBlocks;
        var poolEffort = (poolsResponse.poolEffort * 100).toFixed(2);
        const PoolblocksResponse = await $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=" + totalBlocks);
        
        var effortsum = 0;
        var uncleblocks = 0;
        var orphanedblocks = 0;
        
        for (let i = 0; i < PoolblocksResponse.length; i++) {
            const currentBlock = PoolblocksResponse[i];
            if (typeof currentBlock.effort !== "undefined") {
                effortsum = effortsum + Math.round(currentBlock.effort * 100);
            }
            if (currentBlock.status === "orphaned") {
                orphanedblocks = orphanedblocks + 1;
            }
            if (currentBlock.type === "uncle") {
                uncleblocks = uncleblocks + 1;
            }
        }

        effortsum = Math.round(effortsum / totalBlocks);
        uncleblocks = ((uncleblocks / totalBlocks) * 100).toFixed(2);
        orphanedblocks = ((orphanedblocks / totalBlocks) * 100).toFixed(2);

        $("#CurrentEffort").html(poolEffort + " %");
        $("#AverageEffort").html(effortsum + " %");
        $("#AverageUncleRate").html(uncleblocks + " %");
        $("#AverageOrphanedRate").html(orphanedblocks + " %");
        
    } catch (error) {
        console.error("Error loading blocks effort table:", error);
    }
}

// Load Blocks Page - Enhanced with full original functionality
function loadBlocksPage() {
    console.log('Loading blocks page');
    
    // Load effort statistics
    loadBlocksEffortTable();
    
    // Also load stats data to populate coin value and other info
    loadBlocksStats();
    
    return $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=100")
        .done(function(data) {
            var blockList = "";
            var newBlockList = "";
            var newBlockCount = 0;
            var pendingBlockList = "";
            var pendingBlockCount = 0;
            var confirmedBlockCount = 0;
            
            if (data.length > 0) {
                // Sort blocks by creation date (newest first)
                data.sort((a, b) => new Date(b.created) - new Date(a.created));
                
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    var effort = Math.round(value.effort * 100);
                    var effortClass = "";
                    
                    if (effort < 100) {
                        effortClass = "text-success";
                    } else if (effort < 200) {
                        effortClass = "text-warning";
                    } else {
                        effortClass = "text-danger";
                    }
                    
                    var status = value.status;
                    var blockTable = "";
                    
                    // Mobile-friendly miner address
                    var displayMiner = isMobile()
                        ? value.miner.substring(0, 6) + '...' + value.miner.substring(value.miner.length - 6)
                        : value.miner.substring(0, 8) + '...' + value.miner.substring(value.miner.length - 8);
                    
                    blockTable += "<tr>";
                    blockTable += "<td><div title='" + createDate + "'>" + timeAgo + "</div></td>";
                    blockTable += '<td><a href="#' + currentPool + '/dashboard?address=' + value.miner + '" class="text-info">' + displayMiner + '</a></td>';
                    blockTable += "<td><a href='" + value.infoLink + "' target='_blank'>" + value.blockHeight.toLocaleString() + "</a></td>";
                    blockTable += "<td>" + _formatter(value.networkDifficulty, 6, "") + "</td>";
                    
                    if (typeof value.effort !== "undefined") {
                        blockTable += "<td class='" + effortClass + "'>" + effort + "%</td>";
                    } else {
                        blockTable += "<td>Calculating...</td>";
                    }
                    
                    blockTable += "<td>";
                    if (status === "pending") {
                        if (value.confirmationProgress === 0) {
                            blockTable += "New Block";
                            newBlockCount++;
                        } else {
                            blockTable += "Pending";
                            pendingBlockCount++;
                        }
                    } else if (status === "confirmed") {
                        blockTable += "Confirmed";
                        confirmedBlockCount++;
                    } else if (status === "orphaned") {
                        blockTable += "Orphaned";
                    } else {
                        blockTable += status;
                    }
                    blockTable += "</td>";
                    
                    // Reward
                    if (status === "pending" && value.confirmationProgress === 0) {
                        blockTable += "<td>Waiting...</td>";
                    } else {
                        blockTable += "<td>" + _formatter(value.reward, 6, "") + "</td>";
                    }
                    
                    // Type
                    if (value.type === "uncle") {
                        blockTable += "<td>Uncle</td>";
                    } else if (status === "orphaned") {
                        blockTable += "<td>Orphaned</td>";
                    } else {
                        blockTable += "<td>Block</td>";
                    }
                    
                    // Confirmation progress
                    var progressValue = Math.round(value.confirmationProgress * 100);
                    blockTable += '<td><div class="progress" style="min-width: ' + (isMobile() ? '60px' : '100px') + ';">';
                    blockTable += '<div class="progress-bar" role="progressbar" style="width: ' + progressValue + '%">';
                    blockTable += progressValue + '%</div></div></td>';
                    blockTable += "</tr>";
                    
                    // Assign to appropriate list
                    if (status === "pending") {
                        if (value.confirmationProgress === 0) {
                            newBlockList += blockTable;
                        } else {
                            pendingBlockList += blockTable;
                        }
                    } else {
                        blockList += blockTable;
                    }
                });
            } else {
                blockList = '<tr><td colspan="9" class="text-center text-muted">No blocks found yet</td></tr>';
            }
            
            // Update all three lists
            $("#blockList").html(blockList);
            $("#newBlockList").html(newBlockList || '<tr><td colspan="9" class="text-center text-muted">No new blocks</td></tr>');
            $("#pendingBlockList").html(pendingBlockList || '<tr><td colspan="9" class="text-center text-muted">No pending blocks</td></tr>');
            
            // Update counts
            $("#newBlockCount").text(newBlockCount);
            $("#pendingBlockCount").text(pendingBlockCount);
            $("#confirmedBlockCount").text(confirmedBlockCount);
            $("#nav-blocks-badge").text(newBlockCount + pendingBlockCount + confirmedBlockCount);
        })
        .fail(function() {
            showNotification("Failed to load blocks", "danger");
        });
}

// Load blocks statistics data
function loadBlocksStats() {
    $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) return;
            
            var coinSymbol = getCoinSymbol(pool.coin.type);
            
            // Update total blocks and total paid
            $("#poolBlocks2").text(pool.totalBlocks.toLocaleString());
            $("#totalPaid2").html(pool.totalPaid.toLocaleString() + " " + coinSymbol);
            
            // Get block reward from recent blocks
            $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=1")
                .done(function(blocks) {
                    if (blocks.length > 0) {
                        var reward = blocks[0].reward;
                        $("#blockreward").text(_formatter(reward, 6, "") + " " + coinSymbol);
                        
                        // Try to get coin value
                        getCoinValue(pool.coin.type, reward);
                    }
                });
        });
}

// Get coin value from various exchanges
function getCoinValue(coinType, reward) {
    var getcoin_price = 0;
    var coinSymbol = getCoinSymbol(coinType);
    
    // Try different price APIs based on coin symbol
    if (coinSymbol === "LOG") {
        $.ajax("https://api.coingecko.com/api/v3/simple/price?ids=woodcoin&vs_currencies=usd")
            .done(function(data) {
                getcoin_price = data.woodcoin.usd;
                updateCoinValue(getcoin_price, reward);
            })
            .fail(function() {
                updateCoinValue(0, reward);
            });
    } else {
        // Try Xeggex API first with coin symbol
        $.ajax("https://api.xeggex.com/api/v2/market/getbysymbol/" + coinSymbol + "%2FUSDT")
            .done(function(data) {
                getcoin_price = data.lastPrice;
                updateCoinValue(getcoin_price, reward);
            })
            .fail(function() {
                // Fallback to no price
                updateCoinValue(0, reward);
            });
    }
}

// Update coin value display
function updateCoinValue(price, reward) {
    if (price > 0) {
        $("#coinvalue").html(
            "Coin Price: " + _formatter(price, 6, "USD") + "<br>" +
            "Block Value: " + _formatter(price * reward, 2, "USD")
        );
    } else {
        $("#coinvalue").html("Coin Price: Not Available");
    }
}

// Load Payments Page - Mobile optimized
function loadPaymentsPage() {
    console.log('Loading payments page');
    
    return $.ajax(API + "pools/" + currentPool + "/payments?page=0&pageSize=50")
        .done(function(data) {
            var paymentList = "";
            
            if (data.length > 0) {
                $.each(data, function(index, value) {
                    var createDate = convertUTCDateToLocalDate(new Date(value.created), false);
                    var timeAgo = getTimeAgo(createDate);
                    
                    // Mobile-friendly display
                    var displayAddress = isMobile()
                        ? value.address.substring(0, 8) + '...' + value.address.substring(value.address.length - 8)
                        : value.address.substring(0, 12) + '...' + value.address.substring(value.address.length - 12);
                    
                    var displayTxId = isMobile()
                        ? value.transactionConfirmationData.substring(0, 8) + '...'
                        : value.transactionConfirmationData.substring(0, 16) + '...';
                    
                    paymentList += `
                    <tr>
                        <td data-label="Time" title="${createDate.toLocaleString()}">${timeAgo}</td>
                        <td data-label="Address">
                            <a href="${value.addressInfoLink}" target="_blank">
                                ${displayAddress}
                            </a>
                        </td>
                        <td data-label="Amount">${_formatter(value.amount, 6, "")}</td>
                        <td data-label="Transaction">
                            <a href="${value.transactionInfoLink}" target="_blank">
                                ${displayTxId}
                            </a>
                        </td>
                    </tr>`;
                });
            } else {
                paymentList = '<tr><td colspan="4" class="text-center text-muted">No payments found yet</td></tr>';
            }
            
            $("#paymentList").html(paymentList);
        })
        .fail(function() {
            showNotification("Failed to load payments", "danger");
        });
}

// Enhanced Load Connect Page with Multiple Stratum Servers
function loadConnectPage() {
    console.log('Loading connect page');
    
    return $.ajax(API + "pools")
        .done(function(data) {
            var pool = data.pools.find(p => p.id === currentPool);
            if (!pool) {
                console.error("Pool not found");
                return;
            }
            
            var connectConfig = "";
            var coinName = pool.coin.canonicalName || pool.coin.name || pool.coin.type;
            var coinSymbol = getCoinSymbol(pool.coin.type);
            
            // Build basic configuration table
            connectConfig += `<tr><td><strong>Coin</strong></td><td>${coinName} (${coinSymbol})</td></tr>`;
            connectConfig += `<tr><td><strong>Algorithm</strong></td><td>${pool.coin.algorithm}</td></tr>`;
            
            if (pool.coin.website) {
                connectConfig += `<tr><td><strong>Website</strong></td><td><a href="${pool.coin.website}" target="_blank">${pool.coin.website}</a></td></tr>`;
            }
            
            // Mobile-friendly pool wallet display
            var displayPoolAddress = isMobile()
                ? pool.address.substring(0, 8) + '...' + pool.address.substring(pool.address.length - 8)
                : pool.address.substring(0, 12) + '...' + pool.address.substring(pool.address.length - 12);
            
            connectConfig += `<tr><td><strong>Pool Wallet</strong></td><td><a href="${pool.addressInfoLink}" target="_blank">${displayPoolAddress}</a></td></tr>`;
            connectConfig += `<tr><td><strong>Payout Scheme</strong></td><td>${pool.paymentProcessing.payoutScheme}</td></tr>`;
            connectConfig += `<tr><td><strong>Minimum Payment</strong></td><td>${pool.paymentProcessing.minimumPayment} ${coinSymbol}</td></tr>`;
            connectConfig += `<tr><td><strong>Pool Fee</strong></td><td>${pool.poolFeePercent}%</td></tr>`;
            
            // Build the complete HTML structure including stratum servers section
            var pageHTML = `
                <h2>How to Connect</h2>
                <div style="background-color: var(--card-bg); padding: 20px; border-radius: 12px; box-shadow: var(--shadow);">
                    <h3>Pool Configuration</h3>
                    <div class="table-responsive">
                        <div class="data-table">
                            <table>
                                <tbody id="connectPoolConfig">
                                    ${connectConfig}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div id="stratumSection" style="background-color: var(--card-bg); padding: 20px; border-radius: 12px; margin-top: 20px; box-shadow: var(--shadow);">
                    <h3>Stratum Servers</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Choose the server closest to your location for best performance. 
                        Check the <a href="#" onclick="window.location.hash=''; loadIndex();">server latency monitor</a> to find your best server.
                    </p>
                    <div class="table-responsive">
                        <div class="data-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Server Location</th>
                                        <th>Stratum URL</th>
                                        <th>Ports & Difficulty</th>
                                        <th>SSL Available</th>
                                    </tr>
                                </thead>
                                <tbody id="stratumServersList">
                                    <tr>
                                        <td colspan="4" class="text-center text-muted">Loading servers...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Set the page content
            $(".page-connect").html(pageHTML);
            
            // Populate stratum servers table
            populateStratumServersTable(pool);
        })
        .fail(function() {
            showNotification("Failed to load pool configuration", "danger");
        });
}

// Populate the stratum servers table
function populateStratumServersTable(pool) {
    var serversList = "";
    var stratum = pool.coin.family === "ethereum" ? "stratum2" : "stratum";
    
    // Group servers by region for better organization
    var groupedServers = {};
    servers.forEach(server => {
        if (!groupedServers[server.region]) {
            groupedServers[server.region] = [];
        }
        groupedServers[server.region].push(server);
    });
    
    // Define region order
    var regionOrder = ['us', 'singapore', 'china', 'japan', 'oceania', 'france', 'uk'];
    var regionNames = {
        'us': '🇺🇸 United States',
        'singapore': '🇸🇬 Singapore', 
        'china': '🇨🇳 China',
        'japan': '🇯🇵 Japan',
        'oceania': '🇦🇺 Australia',
        'france': '🇫🇷 France',
        'uk': '🇬🇧 United Kingdom'
    };
    
    // Process servers in order
    regionOrder.forEach(region => {
        if (groupedServers[region]) {
            groupedServers[region].forEach(server => {
                var regionFlag = getRegionFlag(server.region);
                var displayName = isMobile() ? server.location : server.name;
                
                // Build ports information
                var portsInfo = "";
                var sslAvailable = false;
                
                Object.entries(pool.ports).forEach(([port, options], index) => {
                    if (index > 0) portsInfo += "<br>";
                    
                    portsInfo += `<strong>${port}</strong>: `;
                    portsInfo += `Diff ${options.difficulty}`;
                    
                    if (options.varDiff) {
                        portsInfo += ` (VarDiff ${options.varDiff.minDiff}-${options.varDiff.maxDiff})`;
                    }
                    
                    if (options.name) {
                        portsInfo += ` [${options.name}]`;
                    }
                    
                    if (options.tls) {
                        sslAvailable = true;
                    }
                });
                
                // Main stratum URLs
                var primaryPort = Object.keys(pool.ports)[0];
                var stratumUrl = `${stratum}+tcp://${server.host}:${primaryPort}`;
                
                // Add ping info if available
                var pingInfo = "";
                if (serverPingResults[server.host] && serverPingResults[server.host].ping > 0) {
                    var ping = serverPingResults[server.host].ping;
                    var pingClass = ping < 50 ? 'text-success' : ping < 100 ? 'text-warning' : 'text-danger';
                    pingInfo = `<small class="${pingClass}"> (${ping}ms)</small>`;
                }
                
                serversList += `
                    <tr>
                        <td data-label="Server Location">
                            ${regionFlag} <strong>${displayName}</strong>${pingInfo}
                        </td>
                        <td data-label="Stratum URL">
                            <code style="font-size: ${isMobile() ? '11px' : '12px'}; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; cursor: pointer; word-break: break-all;" title="Click to copy">
                                ${stratumUrl}
                            </code>
                        </td>
                        <td data-label="Ports & Difficulty">
                            <small>${portsInfo}</small>
                        </td>
                        <td data-label="SSL Available">
                            ${sslAvailable ? 
                                '<span class="text-success"><i class="fas fa-check-circle"></i> Yes</span>' : 
                                '<span class="text-muted"><i class="fas fa-times-circle"></i> No</span>'
                            }
                        </td>
                    </tr>
                `;
                
                // Add SSL row if available
                if (sslAvailable) {
                    var sslPorts = Object.entries(pool.ports)
                        .filter(([port, options]) => options.tls)
                        .map(([port, options]) => port);
                    
                    if (sslPorts.length > 0) {
                        var sslPort = sslPorts[0];
                        var sslUrl = `${stratum}+ssl://${server.host}:${sslPort}`;
                        
                        serversList += `
                            <tr style="background-color: rgba(0, 212, 255, 0.05);">
                                <td data-label="Server Location">
                                    <i class="fas fa-lock text-success"></i> <em>SSL Encrypted</em>
                                </td>
                                <td data-label="Stratum URL">
                                    <code style="font-size: ${isMobile() ? '11px' : '12px'}; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; cursor: pointer; word-break: break-all;" title="Click to copy">
                                        ${sslUrl}
                                    </code>
                                </td>
                                <td data-label="Ports & Difficulty">
                                    <small>SSL Ports: ${sslPorts.join(', ')}</small>
                                </td>
                                <td data-label="SSL Available">
                                    <span class="text-success"><i class="fas fa-shield-alt"></i> Encrypted</span>
                                </td>
                            </tr>
                        `;
                    }
                }
            });
        }
    });
    
    $("#stratumServersList").html(serversList);
    
    // Add copy to clipboard functionality
    addCopyToClipboardHandlers();
}

// Add copy to clipboard functionality for stratum URLs
function addCopyToClipboardHandlers() {
    // Add click handlers to code elements (stratum URLs)
    $(document).off('click', '#stratumServersList code').on('click', '#stratumServersList code', function(e) {
        e.preventDefault();
        var text = $(this).text().trim();
        
        // Try to copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                showNotification("Stratum URL copied to clipboard!", "success");
                // Temporarily highlight the clicked element
                var element = $(e.target);
                var originalBg = element.css('background-color');
                element.css('background-color', 'var(--accent-primary)').css('color', 'white');
                setTimeout(function() {
                    element.css('background-color', originalBg).css('color', '');
                }, 500);
            }).catch(function() {
                // Fallback for browsers that don't support clipboard API
                fallbackCopyToClipboard(text);
            });
        } else {
            // Fallback for older browsers
            fallbackCopyToClipboard(text);
        }
    });
}

// Fallback copy to clipboard for older browsers
function fallbackCopyToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        var successful = document.execCommand('copy');
        if (successful) {
            showNotification("Stratum URL copied to clipboard!", "success");
        } else {
            showNotification("Could not copy to clipboard. Please copy manually.", "warning");
        }
    } catch (err) {
        showNotification("Could not copy to clipboard. Please copy manually.", "warning");
    }
    
    document.body.removeChild(textArea);
}

// Utility Functions

// Extract coin symbol from coin type (removes trailing numbers)
function getCoinSymbol(coinType) {
    if (!coinType) return '';
    // Remove trailing numbers and return uppercase symbol
    const symbol = coinType.replace(/\d+$/, '').toUpperCase();
    
    // Debug logging if enabled
    if (window.debugMode || window.location.search.includes('debug=true')) {
        console.log(`getCoinSymbol: ${coinType} -> ${symbol}`);
    }
    
    return symbol;
}

// Format numbers with units
function _formatter(value, decimal, unit) {
    if (value === 0) {
        return "0 " + unit;
    }
    
    var si = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "k" },
        { value: 1e6, symbol: "M" },
        { value: 1e9, symbol: "G" },
        { value: 1e12, symbol: "T" },
        { value: 1e15, symbol: "P" },
        { value: 1e18, symbol: "E" }
    ];
    
    for (var i = si.length - 1; i > 0; i--) {
        if (value >= si[i].value) {
            break;
        }
    }
    
    return ((value / si[i].value).toFixed(decimal).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + " " + si[i].symbol + unit);
}

// Convert UTC date to local
function convertUTCDateToLocalDate(date) {
    var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    var offset = date.getTimezoneOffset() / 60;
    var hours = date.getUTCHours();
    newDate.setHours(hours - offset);
    return newDate;
}

// Get time ago string - Mobile friendly
function getTimeAgo(date) {
    var now = new Date();
    var diff = now - date;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (days > 30) {
        return Math.floor(days / 30) + (isMobile() ? "mo" : " months") + " ago";
    } else if (days >= 1) {
        return days + (isMobile() ? "d" : " day" + (days > 1 ? "s" : "")) + " ago";
    } else if (hours >= 1) {
        return hours + (isMobile() ? "h" : " hour" + (hours > 1 ? "s" : "")) + " ago";
    } else if (minutes >= 1) {
        return minutes + (isMobile() ? "m" : " min" + (minutes > 1 ? "s" : "")) + " ago";
    } else if (seconds >= 1) {
        return seconds + (isMobile() ? "s" : " sec" + (seconds > 1 ? "s" : "")) + " ago";
    } else {
        return "just now";
    }
}

// Format time duration
function readableSeconds(seconds) {
    if (seconds < 60) return seconds + "s";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m";
    return Math.floor(seconds / 86400) + "d " + Math.floor((seconds % 86400) / 3600) + "h";
}

// Show notification - Mobile optimized
function showNotification(message, type = "info") {
    var alertClass = "alert-" + type;
    var icon = {
        info: "fa-info-circle",
        success: "fa-check-circle",
        warning: "fa-exclamation-triangle",
        danger: "fa-times-circle"
    }[type] || "fa-info-circle";
    
    // Mobile-friendly positioning
    var topPosition = isMobile() ? "70px" : "80px";
    var rightPosition = isMobile() ? "10px" : "20px";
    var minWidth = isMobile() ? "calc(100% - 20px)" : "300px";
    
    var notification = $(`
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert" 
             style="position: fixed; top: ${topPosition}; right: ${rightPosition}; 
                    z-index: 9999; min-width: ${minWidth}; animation: fadeIn 0.3s;">
            <i class="fas ${icon}"></i> ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `);
    
    $('body').append(notification);
    
    setTimeout(function() {
        notification.fadeOut(function() {
            $(this).remove();
        });
    }, 5000);
}

// Scroll to top
function scrollPageTop() {
    $('html, body').animate({ scrollTop: 0 }, 300);
}

// Server Ping System - Optimized for mobile
var servers = [
    { name: "USA Central (MO)", host: "us1.1miner.net", region: "us", location: "Missouri" },
    { name: "USA East (NY)", host: "us2.1miner.net", region: "us", location: "New York" },
    { name: "USA West (WA)", host: "us3.1miner.net", region: "us", location: "Washington" },
    { name: "USA South (TX)", host: "us4.1miner.net", region: "us", location: "Texas" },
    { name: "Asia (Singapore)", host: "sgp.1miner.net", region: "singapore", location: "Singapore" },
    { name: "China (HK)", host: "cn1.1miner.net", region: "china", location: "Hong Kong" },
    { name: "Japan (Tokyo)", host: "jp.1miner.net", region: "japan", location: "Tokyo" },
    { name: "Australia (Sydney)", host: "au.1miner.net", region: "oceania", location: "Sydney" },
    { name: "Europe (France)", host: "eu1.1miner.net", region: "france", location: "France" },
    { name: "Europe (UK)", host: "eu2.1miner.net", region: "uk", location: "United Kingdom" }
];

var serverPingResults = {};
var bestServer = null;

// Initialize server ping monitoring
function initServerPingMonitoring() {
    // Only run on index page
    if (window.location.hash && window.location.hash !== '#' && !window.location.hash.includes('index')) {
        return;
    }
    
    console.log('Initializing server ping monitoring...');
    
    // Check if table exists
    if (!document.getElementById('serverPingList')) {
        console.log('Server ping table not found, retrying...');
        setTimeout(initServerPingMonitoring, 1000);
        return;
    }
    
    // Initialize results
    servers.forEach(server => {
        serverPingResults[server.host] = {
            name: server.name,
            host: server.host,
            region: server.region,
            location: server.location,
            ping: -1,
            status: 'connecting',
            lastUpdate: null
        };
    });
    
    // Initial update to show connecting status
    updateServerPingTable();
    
    // Start pinging
    setTimeout(pingAllServers, 500);
    
    // Update every 10 seconds
    if (activePingInterval) clearInterval(activePingInterval);
    activePingInterval = setInterval(pingAllServers, 10000);
}

// Optimized ping implementation for mobile
function pingServer(server) {
    return new Promise((resolve) => {
        const measurements = [];
        let completed = 0;
        const timeout = isMobile() ? 8000 : 5000; // Longer timeout for mobile
        const attempts = isMobile() ? 2 : 3; // Fewer attempts on mobile

        function takeMeasurement(attemptNum) {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            fetch(`https://${server.host}/p?_=${Date.now()}&attempt=${attemptNum}`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                signal: controller.signal,
                keepalive: true
            })
            .then(response => {
                clearTimeout(timeoutId);
                const ping = Math.round(performance.now() - startTime);
                measurements.push(ping);
                completed++;
                
                if (completed === attempts) {
                    const bestPing = Math.min(...measurements);
                    const avgPing = Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length);
                    resolve({
                        server: server,
                        ping: bestPing,
                        avgPing: avgPing,
                        status: 'online',
                        measurements: measurements
                    });
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.log(`Ping attempt ${attemptNum} failed for ${server.host}:`, error.message);
                completed++;
                
                if (completed === attempts) {
                    if (measurements.length > 0) {
                        const bestPing = Math.min(...measurements);
                        const avgPing = Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length);
                        resolve({
                            server: server,
                            ping: bestPing,
                            avgPing: avgPing,
                            status: 'degraded',
                            measurements: measurements
                        });
                    } else {
                        resolve({
                            server: server,
                            ping: -1,
                            avgPing: -1,
                            status: 'offline',
                            measurements: []
                        });
                    }
                }
            });
        }

        takeMeasurement(1);
        if (!isMobile()) {
            setTimeout(() => takeMeasurement(2), 100);
            if (attempts > 2) {
                setTimeout(() => takeMeasurement(3), 200);
            }
        } else {
            setTimeout(() => takeMeasurement(2), 200);
        }
    });
}

// Ping all servers
async function pingAllServers() {
    console.log('Pinging all servers...');
    
    try {
        const pingPromises = servers.map(server => pingServer(server));
        const results = await Promise.all(pingPromises);
        
        results.forEach(result => {
            serverPingResults[result.server.host] = {
                name: result.server.name,
                host: result.server.host,
                region: result.server.region,
                location: result.server.location,
                ping: result.ping,
                avgPing: result.avgPing,
                status: result.status,
                lastUpdate: Date.now(),
                measurements: result.measurements
            };
        });
        
        const onlineServers = results.filter(r => r.status === 'online' || r.status === 'degraded');
        if (onlineServers.length > 0) {
            bestServer = onlineServers.reduce((best, current) => 
                (current.ping < best.ping && current.ping > 0) ? current : best
            );
            console.log('Best server:', bestServer.server.host, bestServer.ping + 'ms');
        }
        
        updateServerPingTable();
        
    } catch (error) {
        console.error('Error pinging servers:', error);
    }
}

// Update server ping table - Mobile optimized
function updateServerPingTable() {
    const tbody = document.getElementById('serverPingList');
    if (!tbody) {
        console.log('Server ping table not found');
        return;
    }
    
    const sortedServers = Object.values(serverPingResults)
        .sort((a, b) => {
            if (a.status === 'offline' && b.status !== 'offline') return 1;
            if (a.status !== 'offline' && b.status === 'offline') return -1;
            
            if (a.ping > 0 && b.ping > 0) return a.ping - b.ping;
            if (a.ping > 0) return -1;
            if (b.ping > 0) return 1;
            return 0;
        });
    
    let tableHTML = '';
    sortedServers.forEach((server, index) => {
        const isOnline = server.status !== 'offline';
        const rank = isOnline ? index + 1 - sortedServers.filter(s => s.status === 'offline').length : '-';
        const isBest = isOnline && rank === 1;
        const regionFlag = getRegionFlag(server.region);
        const pingDisplay = server.ping > 0 ? `${server.ping}ms` : '-';
        const statusIcon = getStatusIcon(server.status);
        const statusClass = getStatusClass(server.status);
        
        // Mobile-friendly server name
        const displayName = isMobile() ? server.location : server.name;
        
        tableHTML += `
            <tr class="${isBest ? 'best-server' : ''}" style="animation: fadeIn 0.5s ease-out;">
                <td>
                    <div class="rank-badge ${isBest ? 'rank-best' : ''}">
                        ${rank}
                    </div>
                </td>
                <td>
                    <strong>${displayName}</strong>
                    ${isBest && !isMobile() ? '<span class="badge badge-success ml-2" style="animation: pulse 2s infinite;"><i class="fas fa-bolt"></i> FASTEST</span>' : ''}
                </td>
                <td>${regionFlag} ${isMobile() ? '' : server.location}</td>
                <td class="ping-cell">
                    <span class="${statusClass}">
                        ${pingDisplay}
                    </span>
                    ${!isMobile() && server.ping > 0 ? getPingQualityBar(server.ping) : ''}
                </td>
                <td>
                    <span class="status-indicator ${statusClass}">
                        ${statusIcon} ${isMobile() ? '' : server.status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = tableHTML || '<tr><td colspan="5" class="text-center text-muted">No server data available</td></tr>';
}

// Get region flag emoji
function getRegionFlag(region) {
    const flags = {
        'us': '🇺🇸',
        'singapore': '🇸🇬',
        'oceania': '🇦🇺',
        'france': '🇫🇷' ,
        'china': '🇨🇳',
        'uk': '🇬🇧',
        'japan': '🇯🇵'
    };
    return flags[region] || '🌍';
}

// Get status icon
function getStatusIcon(status) {
    switch(status) {
        case 'online': return '<i class="fas fa-check-circle"></i>';
        case 'degraded': return '<i class="fas fa-exclamation-triangle"></i>';
        case 'offline': return '<i class="fas fa-times-circle"></i>';
        case 'connecting': return '<i class="fas fa-spinner fa-spin"></i>';
        default: return '';
    }
}

// Get status class
function getStatusClass(status) {
    switch(status) {
        case 'online': return 'status-online text-success';
        case 'degraded': return 'status-degraded text-warning';
        case 'offline': return 'status-offline text-danger';
        case 'connecting': return 'status-connecting text-info';
        default: return '';
    }
}

// Get ping quality bar
function getPingQualityBar(ping) {
    let quality = 'excellent';
    let width = '100%';
    let color = '#00ff88';
    
    if (ping > 200) {
        quality = 'poor';
        width = '25%';
        color = '#ff4444';
    } else if (ping > 100) {
        quality = 'fair';
        width = '50%';
        color = '#ffaa00';
    } else if (ping > 50) {
        quality = 'good';
        width = '75%';
        color = '#00d4ff';
    }
    
    return `<div class="ping-quality-bar" style="width: 60px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; display: inline-block; margin-left: 8px; vertical-align: middle;">
        <div style="width: ${width}; height: 100%; background: ${color}; border-radius: 2px; transition: width 0.3s ease;"></div>
    </div>`;
}

// Stop ping monitoring
function stopPingMonitoring() {
    if (activePingInterval) {
        clearInterval(activePingInterval);
        activePingInterval = null;
        console.log('Stopped ping monitoring');
    }
}

// Handle visibility change to save battery on mobile
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Pause intervals when page is hidden
        clearAllIntervals();
        stopPingMonitoring();
    } else {
        // Resume when page is visible
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#index') {
            initServerPingMonitoring();
        }
        // Reload current page to restart intervals
        loadIndex();
    }
});

// Update chart theme when theme changes
window.updateChartTheme = function() {
    Object.values(window.chartInstances).forEach(chart => {
        if (chart) {
            const colors = getThemeColors();
            
            // Update scale colors
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    scale.ticks.color = colors.textSecondary;
                    scale.grid.color = colors.gridColor;
                });
            }
            
            // Update tooltip colors
            if (chart.options.plugins && chart.options.plugins.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                chart.options.plugins.tooltip.titleColor = colors.textPrimary;
                chart.options.plugins.tooltip.bodyColor = colors.textSecondary;
                chart.options.plugins.tooltip.borderColor = colors.borderColor;
            }
            
            chart.update('none');
        }
    });
};

// Auto-initialize on index page
$(document).ready(function() {
    console.log('Document ready - loading page');
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        showNotification('Chart library failed to load. Please refresh the page.', 'danger');
    } else {
        console.log('Chart.js version:', Chart.version);
    }
    
    // Load initial page
    loadIndex();
    
    // Check if we're on the index page
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#index') {
        // Wait a bit for the DOM to be fully ready
        setTimeout(initServerPingMonitoring, 1000);
    }
    
    // Add orientation change handler
    window.addEventListener('orientationchange', function() {
        // Reload charts on orientation change
        setTimeout(() => {
            Object.values(window.chartInstances).forEach(chart => {
                if (chart) {
                    chart.resize();
                }
            });
        }, 500);
    });
    
    // Add debug mode for development
    if (window.location.search.includes('debug=true')) {
        window.debugMode = true;
        console.log('Debug mode enabled');
    }
});

// Handle hash changes
$(window).on('hashchange', function() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#index') {
        setTimeout(initServerPingMonitoring, 500);
    } else {
        stopPingMonitoring();
    }
    loadIndex();
});

// Clean up on page unload
$(window).on('beforeunload', function() {
    clearAllIntervals();
    stopPingMonitoring();
});

// Export functions for external use
window.miningCore = {
    loadIndex,
    loadWallet,
    showNotification,
    _formatter,
    getCoinSymbol,
    loadAllCoinPrices,
    updatePoolCardsWithPrices,
    isMobile,
    isTouchDevice,
    updateDashboardTimeframe,
    updateStatsTimeframe,
    updateDailyPaymentTimeframe,
    createTestChart,
    testAPIStructure,
    loadStatsChart,
    loadDashboardChart,
    updateDailyPaymentChart,
    debugCharts: function() {
        console.log('=== Chart Debug Info ===');
        console.log('Chart.js loaded:', typeof Chart !== 'undefined');
        if (typeof Chart !== 'undefined') {
            console.log('Chart.js version:', Chart.version);
        }
        console.log('Chart instances:', Object.keys(window.chartInstances));
        console.log('Canvas elements found:');
        ['chartStatsHashRatePool', 'chartDashboardHashRate', 'chartDailyPayments'].forEach(id => {
            const el = document.getElementById(id);
            console.log(`- ${id}:`, el ? 'Found' : 'Not found');
            if (el) {
                console.log(`  - Width: ${el.width}, Height: ${el.height}`);
                console.log(`  - Parent: ${el.parentElement.className}`);
            }
        });
        console.log('Current page:', currentPage);
        console.log('Current pool:', currentPool);
        console.log('API URL:', API);
        console.log('Theme colors:', getThemeColors());
        console.log('======================');
    },
    debugPrices: function() {
        console.log('=== Price Debug Info ===');
        $('.pool-card').each(function(index) {
            const cardTitle = $(this).find('.pool-card-title').text();
            const totalPaid = $(this).find('.pool-card-stat-label:contains("Total Paid")').next('.pool-card-stat-value').text();
            console.log(`Pool: ${cardTitle} - Total Paid: ${totalPaid}`);
        });
        console.log('========================');
    }
};
