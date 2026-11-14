// 全站跨页面共享的窗口记录（存在 sessionStorage 里）
function openSmart(url) {
    // 获取当前页面的文件名
    let currentPage = window.location.pathname.split('/').pop();
    
    // 如果当前就是空白页或者根目录，默认当作 index.html
    if (currentPage === '' || currentPage === '/') {
        currentPage = 'index.html';
    }

    // 判断传入的 url 是否就是当前页
    if (url === currentPage) {
        return; // 是当前页，直接结束，不新开，不刷新
    }

    // 从 sessionStorage 取出打开的记录
    let openedWindows = JSON.parse(sessionStorage.getItem('openedWindows')) || {};

    // 检查是否打开过（即使开过了，我们也用 sessionStorage 记录它是否还活着）
    // 但注意：浏览器关闭标签页后，window 对象无法跨页面监测。
    // 只要 sessionStorage 里存了这个 URL，我们就认为它开着，直接跳过去。
    if (openedWindows[url]) {
        // 跳转过去。因为 window.focus 跨页面经常被浏览器拦截，我们用命名窗口的方式
        window.open(url, url).focus();
    } else {
        // 没开过，新开并记录
        window.open(url, url);
        openedWindows[url] = true;
        sessionStorage.setItem('openedWindows', JSON.stringify(openedWindows));
    }
}