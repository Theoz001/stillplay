import AppKit
import WebKit

private let startURL = URL(string: "stillplay://game/spider")!
// The widest desktop table is Spider. The stage padding and scrollbar do not scale.
private let desktopTableWidth: CGFloat = 1040
private let sideSpace: CGFloat = 60
private let baseContentSize = NSSize(width: desktopTableWidth + sideSpace, height: 760)
private let tableSizeMessage = "tableSize"
private let routes: Set<String> = ["", "spider", "solitaire", "freecell", "minesweeper", "hearts", "daily", "about", "secrets"]
private let formats = ["js":"text/javascript", "css":"text/css", "html":"text/html", "wasm":"application/wasm", "woff2":"font/woff2", "svg":"image/svg+xml", "png":"image/png", "json":"application/json", "webmanifest":"application/manifest+json", "mp3":"audio/mpeg", "webm":"audio/webm", "m4a":"audio/mp4"]

private func fittedFrame(for size: NSSize, around current: NSRect, within visible: NSRect) -> NSRect {
    let width = min(size.width, visible.width)
    let height = min(size.height, visible.height)
    let x = min(max(current.midX - width / 2, visible.minX), visible.maxX - width)
    let y = min(max(current.maxY - height, visible.minY), visible.maxY - height)
    return NSRect(x: x, y: y, width: width, height: height)
}

final class Assets: NSObject, WKURLSchemeHandler {
    let root = Bundle.main.resourceURL!.appendingPathComponent("site", isDirectory:true).standardizedFileURL
    func webView(_ view: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == "game" else { task.didFailWithError(URLError(.badURL)); return }
        let name = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let page = routes.contains(name) || name.hasPrefix("daily/") || name.hasPrefix("secrets/")
        let file = root.appendingPathComponent(page ? "index.html" : name).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let bytes = try? Data(contentsOf: file) else { task.didFailWithError(URLError(.fileDoesNotExist)); return }
        let mime = formats[file.pathExtension] ?? "application/octet-stream"
        let response = HTTPURLResponse(url:url, statusCode:200, httpVersion:"HTTP/1.1", headerFields:["Content-Type":mime,"Access-Control-Allow-Origin":"*"])!
        task.didReceive(response); task.didReceive(bytes); task.didFinish()
    }
    func webView(_ view: WKWebView, stop task: WKURLSchemeTask) {}
}

final class App: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    private var requestedTableSize = 100
    private var appliedTableSize: Int?

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(Assets(), forURLScheme:"stillplay")
        config.userContentController.add(self, name: tableSizeMessage)
        #if CHECK
        if CommandLine.arguments.contains("--clean") {
            WKWebsiteDataStore.remove(forIdentifier:testStorageIdentifier) { error in
                if let error { print(error); exit(1) }
                exit(0)
            }
            return
        }
        config.websiteDataStore = WKWebsiteDataStore(forIdentifier:testStorageIdentifier)
        #endif
        var openingURL = startURL
        #if !CHECK
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let migration = support.appendingPathComponent("Stillplay/migration.json")
        if let data = try? Data(contentsOf:migration),
           let values = try? JSONSerialization.jsonObject(with:data) as? [String:String],
           let seed = try? JSONSerialization.data(withJSONObject:values.filter { $0.key.hasPrefix("stillplay-") }),
           let json = String(data:seed,encoding:.utf8) {
            if !UserDefaults.standard.bool(forKey:"didRestoreInitialDeal"),
               let value = values["initialDeal"], let number = Int(value), (1...2147483647).contains(number) {
                var parts = URLComponents(url:startURL,resolvingAgainstBaseURL:false)!
                parts.queryItems = [URLQueryItem(name:"deal", value:String(number))]
                openingURL = parts.url ?? startURL
                UserDefaults.standard.set(true,forKey:"didRestoreInitialDeal")
            }
            let source = """
            if (location.protocol === 'stillplay:' && location.hostname === 'game' && !localStorage.getItem('stillplay-zh-migrated')) {
                for (const [key, value] of Object.entries(\(json))) {
                    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
                }
                localStorage.setItem('stillplay-zh-migrated','1');
            }
            """
            config.userContentController.addUserScript(WKUserScript(source:source,injectionTime:.atDocumentStart,forMainFrameOnly:true))
        }
        #endif
        web = WKWebView(frame:.zero, configuration:config)
        web.navigationDelegate = self; web.uiDelegate = self
        window = NSWindow(contentRect:NSRect(origin: .zero, size: baseContentSize),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "Stillplay"; window.minSize = NSSize(width:530,height:400)
        window.delegate = self
        window.contentView = web
        window.center()
        sizeWindowForTable()
        window.makeKeyAndOrderFront(nil)
        buildMenu()
        web.load(URLRequest(url:openingURL))
        #if CHECK
        startChecks(web)
        #else
        NSApp.activate(ignoringOtherApps:true)
        #endif
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == tableSizeMessage, message.webView === web, message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, url.scheme == "stillplay", url.host == "game",
              let size = message.body as? Int, (80...130).contains(size) else { return }
        requestedTableSize = size
        sizeWindowForTable()
    }

    private func sizeWindowForTable() {
        guard requestedTableSize != appliedTableSize, !window.styleMask.contains(.fullScreen),
              let visible = (window.screen ?? NSScreen.main)?.visibleFrame, !visible.isEmpty else { return }
        let scale = CGFloat(requestedTableSize) / 100
        let width = desktopTableWidth * scale + sideSpace
        let content = NSRect(x: 0, y: 0, width: width, height: baseContentSize.height * scale)
        let preferredSize = window.frameRect(forContentRect: content).size
        window.setFrame(fittedFrame(for: preferredSize, around: window.frame, within: visible), display: true)
        appliedTableSize = requestedTableSize
    }

    func windowDidExitFullScreen(_ notification: Notification) {
        sizeWindowForTable()
    }

    func item(_ title:String, _ action:Selector, _ key:String="") -> NSMenuItem {
        NSMenuItem(title:title,action:action,keyEquivalent:key)
    }
    func buildMenu() {
        let bar = NSMenu()
        func menu(_ name:String) -> NSMenu {
            let holder=NSMenuItem(); let sub=NSMenu(title:name)
            holder.submenu=sub; bar.addItem(holder); return sub
        }
        let app = menu("Stillplay")
        app.addItem(item("关于 Stillplay",#selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        app.addItem(.separator())
        app.addItem(item("隐藏 Stillplay",#selector(NSApplication.hide(_:)),"h"))
        app.addItem(item("退出 Stillplay",#selector(NSApplication.terminate(_:)),"q"))
        let games = menu("游戏")
        for (i, choice) in [("蜘蛛纸牌","spider"),("经典接龙","solitaire"),("空当接龙","freecell"),("扫雷","minesweeper"),("红心大战","hearts"),("每日挑战","daily")].enumerated() {
            let entry=item(choice.0,#selector(selectGame(_:)),String(i+1)); entry.target=self
            entry.representedObject=choice.1; games.addItem(entry)
        }
        let edit=menu("编辑")
        for (name,selector,key) in [("撤销","undo:","z"),("剪切","cut:","x"),("复制","copy:","c"),("粘贴","paste:","v"),("全选","selectAll:","a")] { edit.addItem(item(name,Selector(selector),key)) }
        let windows=menu("窗口")
        windows.addItem(item("最小化",#selector(NSWindow.performMiniaturize(_:)),"m"))
        windows.addItem(item("关闭窗口",#selector(NSWindow.performClose(_:)),"w"))
        NSApp.mainMenu=bar; NSApp.windowsMenu=windows
    }
    @objc func selectGame(_ sender:NSMenuItem) {
        guard let path=sender.representedObject as? String, routes.contains(path) else {return}
        web.load(URLRequest(url:URL(string:"stillplay://game/"+path)!))
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication) -> Bool { true }
    func webView(_ view:WKWebView, decidePolicyFor action:WKNavigationAction, decisionHandler:@escaping (WKNavigationActionPolicy)->Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        guard let url=action.request.url else {decisionHandler(.cancel); return}
        if url.scheme=="stillplay" && url.host=="game" {decisionHandler(.allow); return}
        if action.navigationType == .linkActivated && ["http","https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ view:WKWebView, navigationAction:WKNavigationAction, didBecome download:WKDownload) { download.delegate=self }
    func download(_ download:WKDownload, decideDestinationUsing response:URLResponse, suggestedFilename:String, completionHandler:@escaping(URL?)->Void) {
        let panel=NSSavePanel(); panel.nameFieldStringValue=(suggestedFilename as NSString).lastPathComponent
        panel.beginSheetModal(for:window){ result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func webView(_ webView:WKWebView, runOpenPanelWith parameters:WKOpenPanelParameters, initiatedByFrame frame:WKFrameInfo, completionHandler:@escaping ([URL]?)->Void) {
        let panel=NSOpenPanel(); panel.allowsMultipleSelection=parameters.allowsMultipleSelection; panel.canChooseDirectories=false
        panel.beginSheetModal(for:window){ result in completionHandler(result == .OK ? panel.urls : nil) }
    }
}
let app = NSApplication.shared
let delegate = App()
app.setActivationPolicy(.regular); app.delegate=delegate; app.run()
