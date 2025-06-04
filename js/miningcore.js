/*!
 * Miningcore.js v2.2 - Mobile Optimized Version with Payment Statistics
 * Enhanced with: Payment totals, daily earnings display, improved pool cards
 */

// Global Variables
var WebURL = window.location.protocol + "//" + window.location.hostname + "/";
if (WebURL.substring(WebURL.length-1) != "/") {
    WebURL = WebURL + "/";
}

var API = "https://1miner.net/api/";
if (API.substring(API.length-1) != "/") {
    API = API + "/";
}

var stratumAddress = window.location.hostname;
var currentPage = "index";
var currentPool = null;
var currentAddress = null;
var minerBlocks = {};

// Interval management
var activeIntervals = [];
var activePingInterval = null;

console.log('MiningCore.WebUI:', WebURL);
console.log('API address:', API);
console.log('Stratum address:', "stratum+tcp://" + stratumAddress + ":");

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

            // Create pool cards
            $.each(sortedPools, function(index, value) {
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

// FIXED: Enhanced pool card generator with improved dark mode support
function generatePoolCard(value) {
    var coinLogo = `<img src='img/coin/icon/${value.coin.type.toLowerCase()}.png' 
                    onerror="this.src='img/coin/icon/default.png'"
                    alt='${value.coin.type}' loading="lazy" />`;
    var coinName = value.coin.canonicalName || value.coin.name || value.coin.type;
    
    var pool_networkstat_hash = "Loading...";
    var pool_networkstat_diff = "Loading...";
    var pool_stat_miner = "0";
    var pool_stat_hash = "0 H/s";
    var pool_fee = value.poolFeePercent + "%";
    
    if(value.networkStats) {
        pool_networkstat_hash = _formatter(value.networkStats.networkHashrate, 3, "H/s");
        pool_networkstat_diff = _formatter(value.networkStats.networkDifficulty, 6, "");
    }
    
    if(value.poolStats) {
        pool_stat_miner = value.poolStats.connectedMiners;
        pool_stat_hash = _formatter(value.poolStats.poolHashrate, 3, "H/s");
    }
    
    var pool_status = value.poolStats && value.poolStats.connectedMiners > 0 ? 
        '<span class="text-success"><i class="fas fa-circle"></i> Online</span>' : 
        '<span class="text-muted"><i class="fas fa-circle"></i> Offline</span>';
    
    // Improved mobile-friendly card layout with better dark mode support
    return `
    <a href="#${value.id}/stats" class="pool-card">
        <div class="pool-card-header">
            <div class="pool-card-icon">
                ${coinLogo}
            </div>
            <div>
                <div class="pool-card-title">${coinName}</div>
                <div class="pool-card-algo">${value.coin.algorithm}</div>
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
                <span class="pool-card-stat-label">${isMobile() ? 'Network' : 'Network Rate'}</span>
                <span class="pool-card-stat-value">${pool_networkstat_hash}</span>
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

// Fixed Stats Page Loader
function loadStatsPage() {
    console.log('Loading stats page');
    
    // Clear existing intervals
    clearAllIntervals();
    
    // Load data immediately
    loadStatsData();
    loadStatsChart();
    
    // Set up intervals for updates
    const dataInterval = setInterval(loadStatsData, 60000);
    const chartInterval = setInterval(loadStatsChart, 60000);
    addInterval(dataInterval);
    addInterval(chartInterval);
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

// Enhanced Stats Chart - Mobile responsive
function loadStatsChart() {
    return $.ajax(API + "pools/" + currentPool + "/performance")
        .done(function(data) {
            var labels = [];
            var poolHashRate = [];
            var networkHashRate = [];
            var connectedMiners = [];
            
            // Reduce data points for mobile
            const skipRate = isMobile() ? 4 : 2;
            
            $.each(data.stats, function(index, value) {
                if (index % skipRate === 0) {
                    var date = convertUTCDateToLocalDate(new Date(value.created), false);
                    labels.push(date.getHours() + ":00");
                    poolHashRate.push(value.poolHashrate);
                    networkHashRate.push(value.networkHashrate);
                    connectedMiners.push(value.connectedMiners);
                }
            });
            
            // Mobile-optimized chart options
            var options = {
                height: isMobile() ? "200px" : "300px",
                showArea: true,
                showPoint: false,
                fullWidth: true,
                chartPadding: {
                    right: isMobile() ? 20 : 40,
                    left: isMobile() ? 10 : 20,
                    top: 20,
                    bottom: 20
                },
                axisX: {
                    showGrid: false,
                    labelInterpolationFnc: function(value, index) {
                        return isMobile() ? (index % 2 === 0 ? value : null) : value;
                    }
                },
                axisY: {
                    offset: isMobile() ? 40 : 60,
                    labelInterpolationFnc: function(value) {
                        return _formatter(value, 1, "");
                    }
                },
                lineSmooth: Chartist.Interpolation.cardinal({
                    tension: 0.2
                })
            };
            
            new Chartist.Line("#chartStatsHashRatePool", {
                labels: labels,
                series: [poolHashRate]
            }, options);
        })
        .fail(function() {
            console.error("Failed to load chart data");
        });
}

// Fixed Dashboard Page Loader
function loadDashboardPage() {
    console.log('Loading dashboard page');
    
    // Clear existing intervals
    clearAllIntervals();
    
    // Check for wallet in URL or localStorage
    var walletQueryString = window.location.hash.split(/[#/?]/)[3];
    if (walletQueryString) {
        var wallet = walletQueryString.replace("address=", "");
        if (wallet) {
            $("#walletAddress").val(wallet);
            localStorage.setItem(currentPool + "-walletAddress", wallet);
            loadDashboardData(wallet);
        }
    } else if (localStorage[currentPool + "-walletAddress"]) {
        $("#walletAddress").val(localStorage[currentPool + "-walletAddress"]);
        loadDashboardData(localStorage[currentPool + "-walletAddress"]);
    }
}

// FIXED: Load wallet stats with proper error handling
function loadWallet() {
    var walletAddress = $("#walletAddress").val().trim();
    
    if (!walletAddress) {
        showNotification("Please enter a wallet address", "warning");
        return false;
    }
    
    console.log('Loading wallet:', walletAddress);
    localStorage.setItem(currentPool + "-walletAddress", walletAddress);
    
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
            loadDashboardChart(walletAddress);
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

// Dashboard Chart - Mobile responsive
function loadDashboardChart(walletAddress) {
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/performance")
        .done(function(data) {
            var labels = [];
            var minerHashRate = [];
            
            // Reduce data points for mobile
            const skipRate = isMobile() ? 4 : 2;
            
            $.each(data, function(index, value) {
                if (index % skipRate === 0) {
                    var date = convertUTCDateToLocalDate(new Date(value.created), false);
                    labels.push(date.getHours() + ":00");
                    
                    var workerHashRate = 0;
                    $.each(value.workers, function(index2, value2) {
                        workerHashRate += value2.hashrate;
                    });
                    minerHashRate.push(workerHashRate);
                }
            });
            
            new Chartist.Line("#chartDashboardHashRate", {
                labels: labels,
                series: [minerHashRate]
            }, {
                height: isMobile() ? "150px" : "200px",
                showArea: true,
                showPoint: false,
                fullWidth: true,
                axisX: {
                    showGrid: false,
                    labelInterpolationFnc: function(value, index) {
                        return isMobile() ? (index % 2 === 0 ? value : null) : value;
                    }
                },
                axisY: {
                    offset: isMobile() ? 35 : 47,
                    labelInterpolationFnc: function(value) {
                        return _formatter(value, 1, "");
                    }
                },
                lineSmooth: Chartist.Interpolation.cardinal({
                    tension: 0.2
                })
            });
        })
        .fail(function() {
            console.error("Failed to load dashboard chart");
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

// NEW: Calculate Payment Statistics
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

// Enhanced Load Miner Earnings (Removed Daily Earnings)
function loadEarningsMinerPage(walletAddress) {
    return $.ajax(API + "pools/" + currentPool + "/miners/" + walletAddress + "/balancechanges?page=0&pageSize=999")
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
                earningsList = '<tr><td colspan="3" class="text-center text-muted">No earnings yet</td></tr>';
            }
            
            $("#EarningsList").html(earningsList);
        })
        .fail(function() {
            $("#EarningsList").html('<tr><td colspan="3" class="text-center text-danger">Failed to load earnings</td></tr>');
        });
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
            
            // Update total blocks and total paid
            $("#poolBlocks2").text(pool.totalBlocks.toLocaleString());
            $("#totalPaid2").html(pool.totalPaid.toLocaleString() + " " + pool.coin.type);
            
            // Get block reward from recent blocks
            $.ajax(API + "pools/" + currentPool + "/blocks?page=0&pageSize=1")
                .done(function(blocks) {
                    if (blocks.length > 0) {
                        var reward = blocks[0].reward;
                        $("#blockreward").text(_formatter(reward, 6, "") + " " + pool.coin.type);
                        
                        // Try to get coin value
                        getCoinValue(pool.coin.type, reward);
                    }
                });
        });
}

// Get coin value from various exchanges
function getCoinValue(coinType, reward) {
    var getcoin_price = 0;
    
    // Try different price APIs based on coin
    if (coinType === "LOG") {
        $.ajax("https://api.coingecko.com/api/v3/simple/price?ids=woodcoin&vs_currencies=usd")
            .done(function(data) {
                getcoin_price = data.woodcoin.usd;
                updateCoinValue(getcoin_price, reward);
            })
            .fail(function() {
                updateCoinValue(0, reward);
            });
    } else {
        // Try Xeggex API first
        $.ajax("https://api.xeggex.com/api/v2/market/getbysymbol/" + coinType + "%2FUSDT")
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

// Load Connect Page
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
            
            // Build configuration table
            connectConfig += `<tr><td>Coin</td><td>${coinName} (${pool.coin.type})</td></tr>`;
            connectConfig += `<tr><td>Algorithm</td><td>${pool.coin.algorithm}</td></tr>`;
            
            if (pool.coin.website) {
                connectConfig += `<tr><td>Website</td><td><a href="${pool.coin.website}" target="_blank">${pool.coin.website}</a></td></tr>`;
            }
            
            // Mobile-friendly pool wallet display
            var displayPoolAddress = isMobile()
                ? pool.address.substring(0, 8) + '...' + pool.address.substring(pool.address.length - 8)
                : pool.address.substring(0, 12) + '...' + pool.address.substring(pool.address.length - 12);
            
            connectConfig += `<tr><td>Pool Wallet</td><td><a href="${pool.addressInfoLink}" target="_blank">${displayPoolAddress}</a></td></tr>`;
            connectConfig += `<tr><td>Payout Scheme</td><td>${pool.paymentProcessing.payoutScheme}</td></tr>`;
            connectConfig += `<tr><td>Minimum Payment</td><td>${pool.paymentProcessing.minimumPayment} ${pool.coin.type}</td></tr>`;
            connectConfig += `<tr><td>Pool Fee</td><td>${pool.poolFeePercent}%</td></tr>`;
            
            // Add ports
            $.each(pool.ports, function(port, options) {
                var stratum = pool.coin.family === "ethereum" ? "stratum2" : "stratum";
                connectConfig += "<tr><td>";
                
                if (options.tls) {
                    connectConfig += `${stratum}+ssl://${stratumAddress}:${port}`;
                } else {
                    connectConfig += `${stratum}+tcp://${stratumAddress}:${port}`;
                }
                
                connectConfig += "</td><td>";
                connectConfig += `Difficulty: ${options.difficulty}`;
                if (options.varDiff) {
                    connectConfig += ` (VarDiff ${options.varDiff.minDiff}-${options.varDiff.maxDiff})`;
                }
                connectConfig += ` [${options.name}]</td></tr>`;
            });
            
            $("#connectPoolConfig").html(connectConfig);
            
            // Load miner configuration examples
            loadMinerConfig(pool);
        })
        .fail(function() {
            showNotification("Failed to load pool configuration", "danger");
        });
}

// Load miner configuration examples
function loadMinerConfig(pool) {
    var algorithm = pool.coin.algorithm.toLowerCase();
    var defaultPort = Object.keys(pool.ports)[0];
    
    // Try to load algorithm-specific config
    $("#miner-config").load(`poolconfig/${algorithm}.html`, function(response, status) {
        if (status === "error") {
            // Fall back to default config
            $("#miner-config").load("poolconfig/default.html", function() {
                replaceMinerConfigVariables(pool, defaultPort);
            });
        } else {
            replaceMinerConfigVariables(pool, defaultPort);
        }
    });
}

// Replace variables in miner config
function replaceMinerConfigVariables(pool, defaultPort) {
    var coinName = pool.coin.canonicalName || pool.coin.name || pool.coin.type;
    var config = $("#miner-config").html()
        .replace(/{{ stratumAddress }}/g, stratumAddress + ":" + defaultPort)
        .replace(/{{ coinName }}/g, coinName)
        .replace(/{{ algorithm }}/g, pool.coin.algorithm.toLowerCase())
        .replace(/{{ poolAddress }}/g, pool.address);
    
    $("#miner-config").html(config);
}

// Utility Functions

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
    { name: "USA South (HTX)", host: "us4.1miner.net", region: "us", location: "Houston" },
    { name: "Asia (Singapore)", host: "sgp.1miner.net", region: "asia", location: "Singapore" },    
    { name: "China (HK)", host: "cn1.1miner.net", region: "asia", location: "Hong Kong" },
    { name: "Japan (Tokyo)", host: "jp.1miner.net", region: "asia", location: "Tokyo" },
    { name: "Australia (Sydney)", host: "au.1miner.net", region: "oceania", location: "Sydney" },
    { name: "Europe (France)", host: "eu1.1miner.net", region: "europe", location: "France" },
    { name: "Europe (UK)", host: "eu2.1miner.net", region: "europe", location: "United Kingdom" }
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
        'asia': '🌏',
        'oceania': '🇦🇺',
        'europe': '🇪🇺'
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

// Auto-initialize on index page
$(document).ready(function() {
    console.log('Document ready - loading page');
    
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
        if (currentPage === 'stats') {
            setTimeout(loadStatsChart, 500);
        } else if (currentPage === 'dashboard') {
            setTimeout(() => loadDashboardChart($("#walletAddress").val()), 500);
        }
    });
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
    isMobile,
    isTouchDevice
};
