import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { brand, colors } from "../theme";
import { getAppUrl, isSupabaseConfigured } from "../lib/env";
import { supabase } from "../lib/supabase";

export function LoginScreen({ onGoSignup }: { onGoSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase の公開設定がありません。apps/mobile/.env を確認してください。");
      return;
    }
    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    setBusy(true);
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signError) {
      if (signError.code === "email_not_confirmed" || /not confirmed/i.test(signError.message)) {
        setError("メールが未確認です。確認リンクを開くか、管理者に確認済みにしてもらってください。");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません。");
      }
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Text style={styles.brand}>{brand.name}</Text>
        <Text style={styles.reading}>{brand.reading}</Text>
        <Text style={styles.tagline}>{brand.tagline}</Text>
        <Text style={styles.title}>ログイン</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="メールアドレス"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          autoComplete="password"
          placeholder="パスワード"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={() => void onSubmit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>入る</Text>}
        </Pressable>
        <Pressable onPress={onGoSignup} hitSlop={12} style={styles.linkHit}>
          <Text style={styles.link}>アカウント作成</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export function SignupScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase の公開設定がありません。apps/mobile/.env を確認してください。");
      return;
    }
    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    setBusy(true);
    const { error: signError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });
    setBusy(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    setMessage("確認メールが届いた場合はリンクを開いてください。そのままいける環境もあります。");
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Text style={styles.brand}>{brand.name}</Text>
        <Text style={styles.reading}>{brand.reading}</Text>
        <Text style={styles.tagline}>{brand.tagline}</Text>
        <Text style={styles.title}>アカウント作成</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="メールアドレス"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          autoComplete="new-password"
          placeholder="パスワード（8文字以上）"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}
        <Pressable style={styles.button} onPress={() => void onSubmit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>作成</Text>}
        </Pressable>
        <Pressable onPress={onGoLogin} hitSlop={12} style={styles.linkHit}>
          <Text style={styles.link}>ログインへ</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center" },
  brand: { fontSize: 36, fontWeight: "700", color: colors.ink, letterSpacing: 1.2 },
  reading: { marginTop: 6, fontSize: 14, color: colors.muted },
  tagline: { marginTop: 10, fontSize: 16, color: colors.ink, fontWeight: "600" },
  title: { marginTop: 36, marginBottom: 16, fontSize: 22, fontWeight: "600", color: colors.ink },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
    color: colors.ink,
    minHeight: 52,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  linkHit: { minHeight: 48, justifyContent: "center" },
  link: { marginTop: 4, textAlign: "center", color: colors.muted, fontSize: 15 },
  error: { color: colors.danger, marginBottom: 8, fontSize: 14 },
  ok: { color: colors.muted, marginBottom: 8, fontSize: 14 },
});
