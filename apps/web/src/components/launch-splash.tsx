// アプリを開いた瞬間（ホーム画面・ブラウザ・LINEなどから開いたとき）にロゴを2秒表示する。
// 背景はロゴの背景色と同じにして、アイコンの四角が見えないようにしている。
// 再読み込み・戻る・アプリ内の画面移動では出さない。
// 要素はReactが管理しているので消さずに隠すだけにする（消すと次の画面移動で落ちる）。
// 宣伝ページを見に来た人には出さない（ログイン中か、ホーム画面から開いたときだけ）。
export const LAUNCH_SPLASH_BG = "#020b1c";

const SPLASH_MS = 2000;
const FADE_MS = 400;

const script = (signedIn: boolean) => `(function(){try{
var standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
if(!${signedIn}&&!standalone)return;
var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];
if(nav&&nav.type!=="navigate")return;
var ref=document.referrer;
if(ref&&ref.indexOf(location.origin)===0)return;
var el=document.getElementById("kb-splash");if(!el)return;
el.style.display="flex";
setTimeout(function(){el.style.opacity="0";setTimeout(function(){el.style.display="none";},${FADE_MS});},${SPLASH_MS});
}catch(e){}})();`;

export function LaunchSplash({ signedIn }: { signedIn: boolean }) {
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
      <script dangerouslySetInnerHTML={{ __html: script(signedIn) }} />
    </>
  );
}
