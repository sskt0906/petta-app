"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAtom } from 'jotai';
import { nicknameAtom, familyIdAtom } from "@/store/atoms";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState(""); // 合言葉入力用
  const [loading, setLoading] = useState(true);
  
  // Jotaiのセット用関数（保存成功時に使う）
  const [, setJotaiNickname] = useAtom(nicknameAtom);
  const [, setJotaiFamilyId] = useAtom(familyIdAtom);

  useEffect(() => {
    const checkProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", session.user.id)
        .single();
      
      if (data?.nickname) setNickname(data.nickname);
      setLoading(false);
    };
    checkProfile();
  }, [router]);

  // ★「保存して始める」ボタンの処理
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !inviteCode.trim()) {
      alert("名前と合言葉の両方を入力してください");
      return;
    }

    // 1. まず合言葉から family_id を特定する
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    if (familyError || !family) {
      alert("合言葉が間違っているか、存在しません");
      return;
    }

    // 2. 自分のプロフィールを upsert (なければ作成、あれば更新)
    const { data: { session } } = await supabase.auth.getSession();
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ 
        id: session?.user.id, 
        nickname: nickname,
        family_id: family.id,
        updated_at: new Date()
      });

    if (profileError) {
      alert("プロフィールの保存に失敗しました: " + profileError.message);
    } else {
      // 3. Jotaiにもセット（これで掲示板がすぐ反応する）
      setJotaiNickname(nickname);
      setJotaiFamilyId(family.id);
      
      // 4. 掲示板へ
      router.push("/board");
    }
  };
  const handleCreateFamily = async () => {
  if (!nickname.trim()) return alert("先に名前を入力してください");
  setLoading(true);

  try {
    // 0. 最新のユーザー情報を厳格に取得
    // getSessionよりもgetUserの方がサーバーに問い合わせるため、外部キー制約エラーを防ぎやすいです
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("ログインセッションが切れたか、無効です。一度ログインし直してください。");
      router.push("/login");
      return;
    }

    // ① 8桁のランダムな合言葉を生成
    const newInviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // ② families テーブルに新しい行を作成
    const { data: family, error: fError } = await supabase
      .from('families')
      .insert({
        family_name: `${nickname}の家`,
        invite_code: newInviteCode
      })
      .select()
      .single();

    if (fError) {
      if (fError.code === '23505') {
        return alert("合言葉が衝突しました。もう一度お試しください。");
      }
      throw fError;
    }

    // ③ 特定した user.id を使ってプロフィールを upsert
    const { error: pError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id, // 確実に取得した最新のUUIDを使用
        nickname: nickname,
        family_id: family.id,
        updated_at: new Date().toISOString() // ISO形式の方が安全
      });

    if (pError) throw pError;

    // ④ Jotai を更新して掲示板へ
    setJotaiNickname(nickname);
    setJotaiFamilyId(family.id);
    
    alert(`【重要】家族の合言葉が発行されました！\n\n合言葉： ${newInviteCode}\n\n家族を招待するときはこのコードを教えてあげてください。`);
    router.push("/board");

  } catch (error: any) {
    console.error("Setup Error:", error);
    alert("エラーが発生しました: " + error.message);
  } finally {
    setLoading(false);
  }
};

  if (loading) return <div>読み込み中...</div>;

  return (
<div className="p-8 max-w-md mx-auto space-y-12">
      <h1 className="text-2xl font-bold mb-6 text-center">伝言板の準備</h1>

      {/* セクション1: 既存の家族に入る */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-l-4 border-blue-600 pl-2">既存の家族に参加する</h2>
        <form onSubmit={handleCompleteSetup} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">あなたの名前</label>
            <input
              type="text"
              className="w-full border p-2 rounded-lg"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="たかちゃん"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">教えてもらった合言葉</label>
            <input
              type="text"
              className="w-full border p-2 rounded-lg"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="例：AB12CD34"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            この家族に参加して開ける
          </button>
        </form>
      </section>

      <div className="relative flex py-5 items-center">
        <div className="flex-grow border-t border-gray-300"></div>
        <span className="flex-shrink mx-4 text-gray-400 text-sm">または</span>
        <div className="flex-grow border-t border-gray-300"></div>
      </div>

      {/* セクション2: 新しく家族を作る */}
      <section className="space-y-4 text-center">
        <h2 className="text-lg font-semibold border-l-4 border-green-600 pl-2 text-left">新しく伝言板を用意する</h2>
        <p className="text-sm text-gray-500 text-left">
          あなたが最初の管理者の場合、新しい合言葉を発行して家族を招待できます。
        </p>
        <button 
          onClick={() => {
            if(!nickname.trim()) return alert("先に名前を入力してください");
            handleCreateFamily();
          }}
          className="w-full border-2 border-green-600 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition-colors"
        >
          新しい家族の合言葉を発行する
        </button>
      </section>
    </div>
  );
}