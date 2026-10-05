// ホーム画面から開いたとき（アプリとして起動したとき）だけ、ロゴを2秒間表示する。
// 背景はロゴの背景色と同じにして、アイコンの四角が見えないようにしている。
// ブラウザで開いたときや、同じ起動中の画面移動では出さない。
export const LAUNCH_SPLASH_BG = "#020b1c";

const SPLASH_MS = 2000;
const FADE_MS = 400;

const script = `(function(){try{
var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
if(!standalone||sessionStorage.getItem("kb-splash"))return;
sessionStorage.setItem("kb-splash","1");
var el=document.getElementById("kb-splash");if(!el)return;
el.style.display="flex";
setTimeout(function(){el.style.opacity="0";setTimeout(function(){el.remove();},${FADE_MS});},${SPLASH_MS});
}catch(e){}})();`;

export function LaunchSplash() {
  return (
    <>
      <div
        id="kb-splash"
        aria-hidden
        suppressHydrationWarning
        style={{
          display: "none",
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          alignItems: "center",
          justifyContent: "center",
          background: LAUNCH_SPLASH_BG,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <img src="/splash/logo.png" alt="" width={512} height={512} style={{ width: "44vw", maxWidth: 280, height: "auto" }} />
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
