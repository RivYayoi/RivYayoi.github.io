$(function () {
    /**
     * 文章卡片 hover 效果（现代 CSS transition 化：由 CSS 统一驱动，
     * 这里仅保留兼容旧卡片的无动画版本）.
     */
    let articleCardHover = function () {
        // 现代文章卡片 (.article--row) 的过渡、缩放、投影完全由 CSS 控制，
        // 不再添加 animate.css 的 pulse 跳弹动画，避免突兀.
    };
    articleCardHover();

    /*菜单切换*/
    $('.sidenav').sidenav();

    /* 修复文章卡片 div 的宽度. */
    let fixPostCardWidth = function (srcId, targetId) {
        let srcDiv = $('#' + srcId);
        if (srcDiv.length === 0) {
            return;
        }

        let w = srcDiv.width();
        if (w >= 450) {
            w = w + 21;
        } else if (w >= 350 && w < 450) {
            w = w + 18;
        } else if (w >= 300 && w < 350) {
            w = w + 16;
        } else {
            w = w + 14;
        }
        $('#' + targetId).width(w);
    };

    /**
     * 修复footer部分的位置，使得在内容比较少时，footer也会在底部.
     */
    let fixFooterPosition = function () {
        $('.content').css('min-height', window.innerHeight - 165);
    };

    /**
     * 修复样式.
     */
    let fixStyles = function () {
        fixPostCardWidth('navContainer');
        fixPostCardWidth('artDetail', 'prenext-posts');
        fixFooterPosition();
    };
    fixStyles();

    /*调整屏幕宽度时重新设置文章列的宽度，修复小间距问题*/
    $(window).resize(function () {
        fixStyles();
    });

    /*单列列表布局不再需要瀑布流（masonry 会导致水平卡片高度抖动）；
      仅在存在 .article-row--grid 多列网格时才启用*/
    if ($('#articles .article-row--grid').length) {
        $('#articles').masonry({
            itemSelector: '.article'
        });
    }

    AOS.init({
        // 现代动画：更快、更柔和的缓动，fade-up 更自然；
        // 单张卡片的 CSS 会通过 --i 变量做 60ms 阶梯延迟，
        // 因此这里只设置一个较小的基础 delay 避免重复叠加.
        easing: 'ease-out-cubic',
        duration: 460,
        delay: 20,
        once: true,
        offset: 56,
        disable: function () {
            var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            return reduced;
        }
    });

    /**
     * 现代卡片悬停：鼠标位置跟踪，让 ::before 光晕跟随指针
     * （纯装饰性，reduced-motion 下通过 CSS 已隐藏 ::before）
     */
    var attachCardGlowTracking = function () {
        var $cards = $('.article-card');
        if ($cards.length === 0) return;
        $cards.each(function () {
            var card = this;
            var rafId = null;
            var $card = $(card);
            $card.on('mousemove', function (e) {
                if (rafId) return;
                rafId = requestAnimationFrame(function () {
                    var rect = card.getBoundingClientRect();
                    var mx = ((e.clientX - rect.left) / rect.width) * 100;
                    var my = ((e.clientY - rect.top) / rect.height) * 100;
                    card.style.setProperty('--mx', mx + '%');
                    card.style.setProperty('--my', my + '%');
                    rafId = null;
                });
            });
        });
    };
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        // 仅支持真正 hover 的设备启用（触屏不做）
        attachCardGlowTracking();
    }

    /*文章内容详情的一些初始化特性*/
    let articleInit = function () {
        $('#articleContent a').attr('target', '_blank');

        $('#articleContent img').each(function () {
            let imgPath = $(this).attr('src');
            $(this).wrap('<div class="img-item" data-src="' + imgPath + '" data-sub-html=".caption"></div>');
            // 图片添加阴影
            $(this).addClass("img-shadow img-margin");
            // 图片添加字幕
            let alt = $(this).attr('alt');
            let title = $(this).attr('title');
            let captionText = "";
            // 如果alt为空，title来替
            if (alt === undefined || alt === "") {
                if (title !== undefined && title !== "") {
                    captionText = title;
                }
            } else {
                captionText = alt;
            }
            // 字幕不空，添加之
            if (captionText !== "") {
                let captionDiv = document.createElement('div');
                captionDiv.className = 'caption';
                let captionEle = document.createElement('b');
                captionEle.className = 'center-caption';
                captionEle.innerText = captionText;
                captionDiv.appendChild(captionEle);
                this.insertAdjacentElement('afterend', captionDiv)
            }
        });
        $('#articleContent, #myGallery').lightGallery({
            selector: '.img-item',
            // 启用字幕
            subHtmlSelectorRelative: true
        });

        // progress bar init
        const progressElement = window.document.querySelector('.progress-bar');
        if (progressElement) {
            new ScrollProgress((x, y) => {
                progressElement.style.width = y * 100 + '%';
            });
        }
    };
    articleInit();

    $('.modal').modal();

    /*回到顶部*/
    $('#backTop').click(function () {
        $('body,html').animate({scrollTop: 0}, 400);
        return false;
    });

    /*监听滚动条位置*/
    let $nav = $('#headNav');
    let $backTop = $('.top-scroll');
    // 当页面处于文章中部的时候刷新页面，因为此时无滚动，所以需要判断位置,给导航加上绿色。
    showOrHideNavBg($(window).scrollTop());
    $(window).scroll(function () {
        /* 回到顶部按钮根据滚动条的位置的显示和隐藏.*/
        let scroll = $(window).scrollTop();
        showOrHideNavBg(scroll);
    });

    function showOrHideNavBg(position) {
        let showPosition = 100;
        if (position < showPosition) {
            $nav.addClass('nav-transparent');
            $backTop.slideUp(300);
        } else {
            $nav.removeClass('nav-transparent');
            $backTop.slideDown(300);
        }
    }

    	
	$(".nav-menu>li").hover(function(){
		$(this).children('ul').stop(true,true).show();
		 $(this).addClass('nav-show').siblings('li').removeClass('nav-show');
		
	},function(){
		$(this).children('ul').stop(true,true).hide();
		$('.nav-item.nav-show').removeClass('nav-show');
	})
	
    $('.m-nav-item>a').on('click',function(){
            if ($(this).next('ul').css('display') == "none") {
                $('.m-nav-item').children('ul').slideUp(300);
                $(this).next('ul').slideDown(100);
                $(this).parent('li').addClass('m-nav-show').siblings('li').removeClass('m-nav-show');
            }else{
                $(this).next('ul').slideUp(100);
                $('.m-nav-item.m-nav-show').removeClass('m-nav-show');
            }
    });

    // 初始化加载 tooltipped.
    $('.tooltipped').tooltip();
});

//黑夜模式提醒开启功能（已关闭：用户不需要晚间深色模式提醒）
// setTimeout(function () {
//     if ((new Date().getHours() >= 19 || new Date().getHours() < 7) && !$('body').hasClass('DarkMode')) {
//         let toastHTML = '<span style="color:#97b8b2;border-radius: 10px;>' + '<i class="fa fa-bellaria-hidden="true"></i>晚上使用深色模式阅读更好哦。(ﾟ▽ﾟ)</span>'
//         M.toast({ html: toastHTML })
//     }
// }, 2200);

//黑夜模式判断
if (localStorage.getItem('isDark') === '1') {
    document.body.classList.add('DarkMode');
    $('#sum-moon-icon').addClass("fa-sun").removeClass('fa-moon')
} else {
    document.body.classList.remove('DarkMode');
    $('#sum-moon-icon').removeClass("fa-sun").addClass('fa-moon')
}
