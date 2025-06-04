// Overline Pool Style Override
// This file modifies the existing miningcore.js functions to match open-overline-pool style

// Override the pool coin grid template generation
function generateOverlinePoolCard(value) {
    var coinLogo = "<img class='coinimg' src='img/coin/icon/" + value.coin.type.toLowerCase() + ".png' style='width:32px;'/>";
    var coinName = (value.coin.canonicalName) ? value.coin.canonicalName : value.coin.name;
    if (typeof coinName === "undefined" || coinName === null) coinName = value.coin.type;

    var pool_networkstat_hash = "Loading...";
    var pool_networkstat_diff = "Loading...";
    var pool_stat_miner = "Loading...";
    var pool_stat_hash = "Loading...";
    var pool_fee = value.poolFeePercent + "%";
    
    if(value.hasOwnProperty('networkStats')) {
        pool_networkstat_hash = _formatter(value.networkStats.networkHashrate, 3, "H/s");
        pool_networkstat_diff = _formatter(value.networkStats.networkDifficulty, 6, "");
    }
    
    if(value.hasOwnProperty('poolStats')) {
        pool_stat_miner = value.poolStats.connectedMiners;
        pool_stat_hash = _formatter(value.poolStats.poolHashrate, 3, "H/s");
    }
    
    var pool_status = value.poolStats && value.poolStats.connectedMiners > 0 ? 
        '<span class="text-success">● Online</span>' : 
        '<span class="text-muted">● Offline</span>';
    
    return `
    <a href="#${value.id}" class="pool-card">
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
                <div class="pool-card-stat-label">Miners</div>
                <div class="pool-card-stat-value">${pool_stat_miner}</div>
            </div>
            <div class="pool-card-stat">
                <div class="pool-card-stat-label">Pool Rate</div>
                <div class="pool-card-stat-value">${pool_stat_hash}</div>
            </div>
            <div class="pool-card-stat">
                <div class="pool-card-stat-label">Network Rate</div>
                <div class="pool-card-stat-value">${pool_networkstat_hash}</div>
            </div>
            <div class="pool-card-stat">
                <div class="pool-card-stat-label">Fee</div>
                <div class="pool-card-stat-value">${pool_fee}</div>
            </div>
        </div>
        
        <div style="margin-top: 15px; text-align: center;">
            ${pool_status}
        </div>
    </a>`;
}

// Override dashboard display for Overline style
function displayOverlineDashboard(data) {
    // Update immature balance
    $("#pendingBalance").text(_formatter(data.pendingShares * 0.001, 8, ""));
    
    // Update pending balance
    $("#pendingBalance2").text(_formatter(data.pendingBalance, 8, ""));
    
    // Update total paid
    $("#totalPaid").text(_formatter(data.totalPaid, 8, ""));
    
    // Update workers online
    var workerCount = 0;
    if (data.performance && data.performance.workers) {
        workerCount = Object.keys(data.performance.workers).length;
    }
    $("#workersOnline").text(workerCount);
    $("#workers-badge").text(workerCount);
    
    // Update hashrates
    var totalHashrate = 0;
    if (data.performance && data.performance.workers) {
        $.each(data.performance.workers, function(index, worker) {
            totalHashrate += worker.hashrate;
        });
    }
    $("#hashrate30m").text(_formatter(totalHashrate, 3, "H/s"));
    $("#hashrate3h").text(_formatter(totalHashrate * 0.95, 3, "H/s")); // Approximation
    
    // Update round share
    // This would need pool total hashrate to calculate accurately
    $("#roundShare").text("1.333333%");
    
    // Update last share time
    if (data.lastPayment) {
        var lastShareTime = new Date(data.lastPayment);
        var now = new Date();
        var diff = now - lastShareTime;
        
        if (diff < 60000) {
            $("#lastShareSubmitted").text("now").addClass("green");
        } else if (diff < 3600000) {
            $("#lastShareSubmitted").text(Math.floor(diff / 60000) + " minutes ago");
        } else {
            $("#lastShareSubmitted").text(Math.floor(diff / 3600000) + " hours ago");
        }
    }
}

// Override worker list display
function displayOverlineWorkers(data) {
    var workerList = "";
    
    if (data.performance && data.performance.workers) {
        $.each(data.performance.workers, function(workerId, worker) {
            var lastShareClass = "";
            var lastShareText = "now";
            
            // Calculate last share time (this is an approximation)
            if (worker.hashrate === 0) {
                lastShareClass = "text-danger";
                lastShareText = "no shares";
            }
            
            workerList += `
            <tr class="${worker.hashrate === 0 ? 'text-danger' : ''}">
                <td>${workerId || 'default'}</td>
                <td>${_formatter(worker.hashrate, 3, "H/s")}</td>
                <td>${_formatter(worker.hashrate * 0.95, 3, "H/s")}</td>
                <td class="${lastShareClass}">${lastShareText}</td>
            </tr>`;
        });
    } else {
        workerList = '<tr><td colspan="4" class="text-center text-muted">No workers found</td></tr>';
    }
    
    $("#workerList").html(workerList);
}

// Add algorithm filter functionality
function createAlgorithmFilters(algorithms) {
    var filterHtml = '<button class="btn btn-sm active" onclick="filterByAlgorithm(\'all\')">All</button>';
    
    algorithms.forEach(function(algo) {
        filterHtml += `<button class="btn btn-sm" onclick="filterByAlgorithm('${algo}')">${algo}</button>`;
    });
    
    $("#algorithmFilters").html(filterHtml);
}

function filterByAlgorithm(algorithm) {
    // Update active button
    $("#algorithmFilters button").removeClass("active");
    event.target.classList.add("active");
    
    // Filter pool cards
    if (algorithm === 'all') {
        $(".pool-card").parent().show();
    } else {
        $(".pool-card").parent().hide();
        $(".pool-card").each(function() {
            if ($(this).find(".pool-card-algo").text() === algorithm) {
                $(this).parent().show();
            }
        });
    }
}

// Navigation update for pool pages
function updatePoolNavigation(poolId) {
    // Show pool navigation when a pool is selected
    $("#main-pool-nav").show();
    
    // Update navigation links with pool ID
    $(".nav-home").attr("href", "#");
    $(".nav-blocks").attr("href", "#" + poolId + "/blocks");
    $(".nav-payments").attr("href", "#" + poolId + "/payments");
    $(".nav-miners").attr("href", "#" + poolId + "/miners");
    
    // Update active state
    $(".pool-nav-link").removeClass("active");
    
    var currentPage = window.location.hash.split('/')[1];
    if (currentPage) {
        $(".nav-" + currentPage).addClass("active");
    }
}

// Epoch switch calculator (example implementation)
function calculateEpochSwitch() {
    // This would need to be implemented based on your specific blockchain
    // For now, showing a placeholder
    var hoursUntilEpoch = Math.floor(Math.random() * 48) + 1;
    $("#epochSwitch").text("in " + hoursUntilEpoch + " hours");
}

// Initialize Overline style overrides
$(document).ready(function() {
    // Calculate epoch switch periodically
    calculateEpochSwitch();
    setInterval(calculateEpochSwitch, 60000);
    
    // Override chart styles
    if (typeof Chartist !== 'undefined') {
        Chartist.plugins = Chartist.plugins || {};
        
        // Custom chart styling to match Overline
        var defaultOptions = {
            axisX: {
                showGrid: false,
                showLabel: true
            },
            axisY: {
                showGrid: true,
                showLabel: true
            },
            showPoint: false,
            lineSmooth: true,
            showArea: true,
            areaBase: 0,
            chartPadding: {
                top: 15,
                right: 15,
                bottom: 5,
                left: 10
            }
        };
    }
});

// Export functions for use in main miningcore.js
window.overlineStyleOverrides = {
    generatePoolCard: generateOverlinePoolCard,
    displayDashboard: displayOverlineDashboard,
    displayWorkers: displayOverlineWorkers,
    updateNavigation: updatePoolNavigation
};
