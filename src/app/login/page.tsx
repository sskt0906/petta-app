"use client"; // 1. なぜこれが必要か？

import { useState } from "react";
import { supabase } from "@/lib/supabase"; // supabaseクライアントのインポート

export default function LoginPage() { // コンポーネント定義
  const [email, setEmail] = useState(""); // メールアドレスの状態管理
  const [isLoading, setIsLoading] = useState(false); // ローディング状態の管理
  const [isSent, setIsSent] = useState(false);   // 送信完了状態の管理

  /* ログイン処理（Magic Link送信）*/
  const handleLogin = async (e: React.FormEvent) => { // フォーム送信イベントの型指定
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // メールのリンクをクリックした後の戻り先
        emailRedirectTo: `${window.location.origin}/board`,
      },
    });

    if (error) {
      alert("エラーが起きました: " + error.message);
    } else {
      setIsSent(true);
    }
    setIsLoading(false);
  };

  if (isSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">メールを送りました！</h1>
        <p>届いたメールのボタンを押すと、合言葉発行画面に入れます。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Petta</h1>
        <p className="text-gray-600 mb-6 text-center">
          メールアドレスを入れて届いたメールのリンクをクリックするだけで、<br />合言葉発行画面に入れます。
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? "送信中..." : "メールを送る"}
          </button>
        </form>
      </div>
    </div>
  );
}