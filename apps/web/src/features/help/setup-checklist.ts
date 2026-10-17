/** 管理画面の「はじめにやること」。全部終わったら出さない。 */

export type SetupState = {
  workerCount: number;
  workerPasscodeSet: boolean;
  siteCount: number;
  scheduleCount: number;
  /** 作業員が「作業開始」を押したことがあるか（＝スマホで使い始めた） */
  workStarted: boolean;
};

export type SetupStep = { key: string; label: string; detail: string; href: string; done: boolean };

export function setupSteps(state: SetupState): SetupStep[] {
  return [
    {
      key: "workers",
      label: "作業員を登録する",
      detail: "名簿があれば Excel からまとめて入れられます",
      href: state.workerCount > 0 ? "/workers" : "/kanri/import",
      done: state.workerCount > 0,
    },
    {
      key: "passcode",
      label: "作業員の合言葉を決める",
      detail: "作業員はメールアドレスなしで、会社コードと合言葉で入れます",
      href: "/settings#passcode",
      done: state.workerPasscodeSet,
    },
    {
      key: "sites",
      label: "現場を登録する",
      detail: "今動いている現場を1件入れてみましょう",
      href: "/sites/new",
      done: state.siteCount > 0,
    },
    {
      key: "schedules",
      label: "明日の予定を入れる",
      detail: "誰がどの現場に行くかを入れると、作業員のスマホに出ます",
      href: "/schedule/new",
      done: state.scheduleCount > 0,
    },
    {
      key: "phones",
      label: "作業員のスマホで開いてもらう",
      detail: "設定の「作業員に案内する」から LINE で送るか、案内を印刷して渡します",
      href: "/settings#passcode",
      done: state.workStarted,
    },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean } {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}
