// Miningcore WebUI - Enhanced with Visual Effects
// Configuration
var WebURL = "https://1miner.net/";
var API = "https://1miner.net/api/";
var stratumAddress = "stratum+tcp://" + WebURL + ":";

// Global variables
var currentPage = 'dashboard';
var poolData = {};
var refreshInterval = 5000; // 5 seconds
var updateTimer = null;

// Utility functions
function formatHashrate(hashrate) {
    var units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
    var unitIndex = 0;
    
    while (hashrate >= 1000 && unitIndex < units.length - 1) {
        hashrate /= 1000;
        unitIndex++;
    }
    
    return hashrate.toFixed(2) + ' ' + units[unitIndex];
}

function formatNumber(num, decimals = 2) {
    return parseFloat(num).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function animateNumber(element, start, end, duration) {
    var startTime = null;
    var startValue = parseFloat(start) || 0;
    var endValue = parseFloat(end) || 0;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        var progress = Math.min((currentTime - startTime) / duration, 1);
        
        var currentValue = startValue + (endValue - startValue) * easeOutQuart(progress);
        element.textContent = formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

// Show loading animation
function showLoading() {
    $('.loading-screen').fadeIn(300);
}

// Hide loading animation
function hideLoading() {
    $('.loading-screen').fadeOut(300);
}

// API Functions
function fetchPoolStats() {
    $.ajax({
        url: API + 'pools',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            poolData = data;
            updateDashboard();
            hideLoading();
        },
        error: function(xhr, status, error) {
            console.error('Error fetching pool stats:', error);
            showError('Unable to connect to pool API');
            hideLoading();
        }
    });
}

function fetchMinerStats(address) {
    showLoading();
    $.ajax({
        url: API + 'miners/' + address,
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            updateMinerStats(data);
            hideLoading();
        },
        error: function(xhr, status, error) {
            console.error('Error fetching miner stats:', error);
            showError('Miner not found');
            hideLoading();
        }
    });
}

// Update Functions
function updateDashboard() {
    if (!poolData || !poolData.pools) return;
    
    var totalHashrate = 0;
    var totalMiners = 0;
    var totalBlocks = 0;
    var totalPaid = 0;
    
    // Clear table
    $('.pool-coin-table').empty();
    
    // Process each pool
    $.each(poolData.pools, function(poolId, pool) {
        totalHashrate += pool.poolStats.poolHashrate || 0;
        totalMiners += pool.poolStats.connectedMiners || 0;
        totalBlocks += pool.totalBlocks || 0;
        totalPaid += pool.totalPaid || 0;
        
        // Add row to table with animation
        var row = $('<tr>')
            .css('opacity', '0')
            .append($('<td>').html('<span class="coin-name">' + pool.coin.name + '</span>'))
            .append($('<td>').text(pool.coin.algorithm))
            .append($('<td>').html('<span class="miner-count">' + pool.poolStats.connectedMiners + '</span>'))
            .append($('<td>').html('<span class="hashrate">' + formatHashrate(pool.poolStats.poolHashrate) + '</span>'))
            .append($('<td>').text(pool.poolFeePercent + '%'))
            .append($('<td>').text(formatHashrate(pool.networkStats.networkHashrate)))
            .append($('<td>').text(formatNumber(pool.networkStats.networkDifficulty, 0)))
            .append($('<td>').html(
                '<button class="btn btn-sm btn-primary view-pool" data-pool="' + poolId + '">' +
                '<i class="fa fa-eye"></i> View</button>'
            ));
        
        $('.pool-coin-table').append(row);
        
        // Animate row appearance
        setTimeout(function() {
            row.animate({ opacity: 1 }, 500);
        }, 100);
    });
    
    // Animate counter updates
    animateNumber(document.getElementById('pool-hashrate'), 
        $('#pool-hashrate').text().replace(/[^\d.]/g, ''), 
        totalHashrate, 1000);
    
    animateNumber(document.getElementById('active-miners'), 
        $('#active-miners').text(), 
        totalMiners, 1000);
    
    animateNumber(document.getElementById('total-blocks'), 
        $('#total-blocks').text(), 
        totalBlocks, 1000);
    
    animateNumber(document.getElementById('total-paid'), 
        $('#total-paid').text().replace(/[^\d.]/g, ''), 
        totalPaid, 1000);
    
    // Update formatted values after animation
    setTimeout(function() {
        $('#pool-hashrate').text(formatHashrate(totalHashrate));
        $('#total-paid').text(formatNumber(totalPaid, 8) + ' coins');
    }, 1100);
}

function showError(message) {
    var alertHtml = 
        '<div class="alert alert-danger alert-dismissible fade in" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert">&times;</button>' +
        '<strong>Error!</strong> ' + message +
        '</div>';
    
    $('#main-content').prepend(alertHtml);
    
    // Auto dismiss after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut(function() {
            $(this).remove();
        });
    }, 5000);
}

// Page Navigation
function showPage(page) {
    currentPage = page;
    
    // Update active menu
    $('.sidebar-menu li').removeClass('active');
    $('.' + page + '-nav').parent().addClass('active');
    
    // Fade out current content
    $('#main-content').fadeOut(300, function() {
        // Load new page content
        loadPageContent(page);
        
        // Fade in new content
        $('#main-content').fadeIn(300);
    });
}

function loadPageContent(page) {
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'stats':
            loadStats();
            break;
        case 'miners':
            loadMiners();
            break;
        case 'blocks':
            loadBlocks();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'help':
            loadHelp();
            break;
    }
}

// Page loaders
function loadDashboard() {
    $('#main-content').html($('.page-dashboard').html());
    fetchPoolStats();
}

function loadStats() {
    var html = 
        '<section class="content-header">' +
        '<h1>Pool Statistics <small>Detailed analytics</small></h1>' +
        '</section>' +
        '<div class="row">' +
        '<div class="col-xs-12">' +
        '<div class="box">' +
        '<div class="box-header"><h3 class="box-title">Hashrate Chart</h3></div>' +
        '<div class="box-body">' +
        '<canvas id="hashrate-chart" height="100"></canvas>' +
        '</div></div></div></div>';
    
    $('#main-content').html(html);
    // Initialize chart here
}

function loadMiners() {
    var html = 
        '<section class="content-header">' +
        '<h1>Miners <small>Connected workers</small></h1>' +
        '</section>' +
        '<div class="row">' +
        '<div class="col-xs-12">' +
        '<div class="box">' +
        '<div class="box-header">' +
        '<h3 class="box-title">Miner Lookup</h3>' +
        '<div class="box-tools">' +
        '<div class="input-group input-group-sm" style="width: 350px;">' +
        '<input type="text" id="miner-address" class="form-control pull-right" placeholder="Enter wallet address">' +
        '<div class="input-group-btn">' +
        '<button type="submit" class="btn btn-default" id="lookup-miner"><i class="fa fa-search"></i></button>' +
        '</div></div></div></div>' +
        '<div class="box-body" id="miner-stats"></div>' +
        '</div></div></div>';
    
    $('#main-content').html(html);
}

function loadBlocks() {
    var html = 
        '<section class="content-header">' +
        '<h1>Blocks <small>Recently found blocks</small></h1>' +
        '</section>' +
        '<div class="row">' +
        '<div class="col-xs-12">' +
        '<div class="box">' +
        '<div class="box-body">' +
        '<table class="table table-striped table-hover">' +
        '<thead><tr>' +
        '<th>Height</th><th>Time</th><th>Effort</th><th>Status</th><th>Reward</th>' +
        '</tr></thead>' +
        '<tbody id="blocks-table"></tbody>' +
        '</table></div></div></div></div>';
    
    $('#main-content').html(html);
    fetchBlocks();
}

function loadPayments() {
    var html = 
        '<section class="content-header">' +
        '<h1>Payments <small>Recent transactions</small></h1>' +
        '</section>' +
        '<div class="row">' +
        '<div class="col-xs-12">' +
        '<div class="box">' +
        '<div class="box-body">' +
        '<table class="table table-striped table-hover">' +
        '<thead><tr>' +
        '<th>Time</th><th>Amount</th><th>Fee</th><th>Transaction</th>' +
        '</tr></thead>' +
        '<tbody id="payments-table"></tbody>' +
        '</table></div></div></div></div>';
    
    $('#main-content').html(html);
    fetchPayments();
}

function loadHelp() {
    var html = 
        '<section class="content-header">' +
        '<h1>Help <small>Getting started</small></h1>' +
        '</section>' +
        '<div class="row">' +
        '<div class="col-md-6">' +
        '<div class="box">' +
        '<div class="box-header"><h3 class="box-title">Connection Details</h3></div>' +
        '<div class="box-body">' +
        '<p>Connect your miner using the following settings:</p>' +
        '<pre id="connection-info"></pre>' +
        '</div></div></div>' +
        '<div class="col-md-6">' +
        '<div class="box">' +
        '<div class="box-header"><h3 class="box-title">Supported Miners</h3></div>' +
        '<div class="box-body">' +
        '<ul id="supported-miners"></ul>' +
        '</div></div></div></div>';
    
    $('#main-content').html(html);
    loadConnectionInfo();
}

// Additional fetch functions
function fetchBlocks() {
    $.ajax({
        url: API + 'blocks',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            updateBlocksTable(data);
        }
    });
}

function fetchPayments() {
    $.ajax({
        url: API + 'payments',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            updatePaymentsTable(data);
        }
    });
}

// Auto refresh
function startAutoRefresh() {
    if (updateTimer) clearInterval(updateTimer);
    
    updateTimer = setInterval(function() {
        if (currentPage === 'dashboard') {
            fetchPoolStats();
        }
    }, refreshInterval);
}

// Initialize
$(document).ready(function() {
    // Show loading initially
    showLoading();
    
    // Load dashboard
    fetchPoolStats();
    
    // Start auto refresh
    startAutoRefresh();
    
    // Navigation handlers
    $('.home-nav').click(function(e) {
        e.preventDefault();
        showPage('dashboard');
    });
    
    $('.stats-nav').click(function(e) {
        e.preventDefault();
        showPage('stats');
    });
    
    $('.miners-nav').click(function(e) {
        e.preventDefault();
        showPage('miners');
    });
    
    $('.blocks-nav').click(function(e) {
        e.preventDefault();
        showPage('blocks');
    });
    
    $('.payments-nav').click(function(e) {
        e.preventDefault();
        showPage('payments');
    });
    
    $('.help-nav').click(function(e) {
        e.preventDefault();
        showPage('help');
    });
    
    // Dynamic event handlers
    $(document).on('click', '#lookup-miner', function() {
        var address = $('#miner-address').val();
        if (address) {
            fetchMinerStats(address);
        }
    });
    
    $(document).on('click', '.view-pool', function() {
        var poolId = $(this).data('pool');
        // Handle pool view
        console.log('View pool:', poolId);
    });
    
    // Add parallax effect to particles on mouse move
    $(document).mousemove(function(e) {
        var mouseX = e.pageX;
        var mouseY = e.pageY;
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();
        
        var moveX = (mouseX - windowWidth / 2) / windowWidth * 20;
        var moveY = (mouseY - windowHeight / 2) / windowHeight * 20;
        
        $('#particles-js').css({
            'transform': 'translate(' + moveX + 'px, ' + moveY + 'px)'
        });
    });
    
    // Add glow effect to stats on hover
    $('.small-box').hover(
        function() {
            $(this).css('box-shadow', '0 0 30px rgba(0, 255, 255, 0.8)');
        },
        function() {
            $(this).css('box-shadow', '');
        }
    );
    
    // Smooth scroll for anchor links
    $('a[href^="#"]').on('click', function(e) {
        e.preventDefault();
        var target = this.hash;
        if (target) {
            $('html, body').animate({
                scrollTop: $(target).offset().top - 70
            }, 800, 'swing');
        }
    });
    
    // Add typing effect to headers
    function typeWriter(element, text, speed) {
        var i = 0;
        element.text('');
        
        function type() {
            if (i < text.length) {
                element.text(element.text() + text.charAt(i));
                i++;
                setTimeout(type, speed);
            }
        }
        
        type();
    }
    
    // Apply typing effect to main header
    typeWriter($('.content-header h1').first(), 'Pool Dashboard', 50);
});

// Handle connection errors gracefully
$(document).ajaxError(function(event, xhr, settings, error) {
    console.error('Ajax error:', error);
    if (xhr.status === 0) {
        showError('Unable to connect to pool API. Please check your connection.');
    }
});
