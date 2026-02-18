"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Note } from "@/types/database";
import { useAtom } from 'jotai';
import { nicknameAtom, familyIdAtom } from "@/store/atoms";

export default function BoardPage() {
  const router = useRouter();

// --- 状態管理 (Jotai: 世界共通の箱) ---
  const [myId, setMyId] = useState<string | null>(null);
  const [nickname, setNickname] = useAtom(nicknameAtom);
  const [familyId, setFamilyId] = useAtom(familyIdAtom);
// --- 状態管理 (Local: この画面だけの内輪ネタ) ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // ファイル実体
const [previewUrl, setPreviewUrl] = useState<string | null>(null);   // プレビュー用URL
  // 認証とデータ取得の処理
useEffect(() => {
  // チャンネルを保持するための変数
  let channel: any;

  const initializeBoard = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn("セッションが見つかりません");
      router.replace("/");
      return;
    }
    setMyId(session.user.id);
    const { data: profile,error } = await supabase
      .from("profiles")
      .select("family_id, nickname")
      .eq("id", session.user.id)
      .single();

    if (error ||!profile?.nickname|| !profile?.family_id) {
      router.replace("/profile/setup");
      return;
    }

    setNickname(profile.nickname);
    setFamilyId(profile.family_id);

    const fId = profile.family_id;
    await fetchNotes(fId);
    await fetchFamilyInfo(fId);

    // リアルタイム設定を外部変数に代入
    channel = supabase
      .channel(`realtime-notes-${fId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `family_id=eq.${fId}` },
        () => fetchNotes(fId)
      )
      .subscribe();

    setLoading(false);
  };

  initializeBoard();

  // useEffect 直系の return でお掃除を行う
  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}, [router, setNickname, setFamilyId]);

  // --- メモ取得関数 ---
  const fetchNotes = async (fId: string) => {
    const { data, error } = await supabase
      .from("notes")
      .select(`*, profiles(nickname)`)
      .eq("family_id", fId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setNotes(data as Note[]);
    }
  };

  // --- 招待コード取得関数 ---
  const fetchFamilyInfo = async (fId: string) => {
    const { data, error } = await supabase
      .from('families')
      .select('invite_code')
      .eq('id', fId)
      .single();
    if (error) {
    console.error("合言葉の取得に失敗:", error.message, error.details); // ← ログ2
    return;
    }

    if (data) {
    setInviteCode(data.invite_code);
  } else {
    console.warn("データが空でした。"); // ← ログ4
  }
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // ファイルサイズ制限 (例: 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("ファイルサイズが大きすぎます（5MBまで）");
    return;
  }

  // 状態に保存
  setSelectedFile(file);

  // プレビュー用URLを作成（ブラウザ内の一時的なURL）
  const url = URL.createObjectURL(file);
  setPreviewUrl(url);
};
  // --- メモ保存処理 ---
const handleSave = async () => {
  if ((!newContent.trim() && !selectedFile)|| !familyId) return;
  const { data: { session } } = await supabase.auth.getSession();
  
  // セッションがない（ログインしていない）場合のガード
  if (!session) {
    alert("セッションが切れました。再ログインしてください。");
    return;
  }
  let uploadedImageUrl = null;

  try {
    // 画像がある場合は先にアップロード
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${familyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('note-attachments')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError; //catchへ飛ばす

      const { data } = supabase.storage
        .from('note-attachments')
        .getPublicUrl(filePath);
      
      uploadedImageUrl = data.publicUrl;
    }
  // 保存用の新しいオブジェクトを先に作る
  const newNoteTemp: Note = {
    id: crypto.randomUUID(),
    family_id: familyId,
    author_id: session.user.id, 
    content: newContent,
    content_type: 'text',       
    x_position: 0,              
    y_position: 0,              
    color_type: 'yellow',
    created_at: new Date().toISOString(),
    is_pinned: false,
    image_url: uploadedImageUrl, // 画像URLを追加
    profiles: { nickname: nickname }
  };

  // DBに届く前に画面に表示！
  setNotes((prev) => [newNoteTemp, ...prev]);

  //
  setNewContent(""); // 入力欄をクリア
  setSelectedFile(null);
  setPreviewUrl(null);
  setIsModalOpen(false); // モーダルを閉じる
  

  // 裏でSupabaseに保存
  const { error:insertError } = await supabase.from("notes").insert({
    family_id: familyId,
    author_id: session.user.id,
    content: newContent,
    content_type: 'text',
    color_type: 'yellow',
    x_position: 0,
    y_position: 0,
    image_url: uploadedImageUrl // 画像URLをDBに保存
  });

  if (insertError) throw insertError;
    
  } catch(err:any) {
    //  詳細を見るためのログ
    console.error("保存失敗の理由:", err.message);
    console.error("エラー詳細:", err.details);
    console.error("ヒント:", err.hint);
    alert("保存に失敗しました");
    // 失敗した場合は、先ほど追加したメモをリストから消して「なかったこと」にする
    fetchNotes(familyId);
  } finally {
  }
};
  const togglePin = async (noteId: string, currentPinned: boolean) => {
  // 楽観的更新：画面上の表示を先に変える
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, is_pinned: !currentPinned } : n
    ).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))); // 簡易的な並び替え

    const { error } = await supabase
      .from("notes")
      .update({ is_pinned: !currentPinned })
      .eq("id", noteId);

    if (error) {
      console.error("ピン留め失敗:", error.message);
      fetchNotes(familyId!); // 失敗したら元に戻す
    }
  };
  // --- ドラッグ終了処理 ---
  const handleDragEnd = async (noteId: string, e: React.DragEvent) => {
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, e.clientX - rect.left - 80);
    const y = Math.max(0, e.clientY - rect.top - 80);

    const { error } = await supabase
      .from("notes")
      .update({ x_position: x, y_position: y })
      .eq("id", noteId);

    if (error) console.error("位置の保存に失敗しました:", error.message);
  };

  // --- 削除処理 ---
  // 1. 引数を2個に増やす
const handleDelete = async (noteId: string, imageUrl: string | null) => {
  if (!confirm("このメモを剥がしますか？")) return;

  // 楽観的更新（先に画面から消す）
  setNotes((prev) => prev.filter((n) => n.id !== noteId));

  try {
    // 2. もし画像があるならStorageからも消す
if (imageUrl) {
  // 1. クエリパラメータ（?t=...）を除去
  const baseUri = imageUrl.split('?')[0];
  
  // 2. バケット名を探し、その「次」の文字からのインデックスを特定
  const bucketName = 'note-attachments/';
  const bucketIndex = baseUri.indexOf(bucketName);
  
  if (bucketIndex !== -1) {
    // バケット名の長さ分だけ進めた位置から後ろをすべて取得
    let path = baseUri.substring(bucketIndex + bucketName.length);
    
    // 3. 【重要】先頭に / がもし付いていたら削除する
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // 4. デコード（%2F などを / に戻す）
    const finalPath = decodeURIComponent(path);

    const { data, error: storageError } = await supabase.storage
      .from('note-attachments')
      .remove([finalPath]);

    if (storageError) {
      console.error("削除エラー:", storageError);
    } 
  }
}

    // 3. DBから削除
    const { error: dbError } = await supabase.from("notes").delete().eq("id", noteId);
    if (dbError) throw dbError;

  } catch (error: any) {
    console.error("削除失敗:", error.message);
    alert("削除に失敗しました");
    fetchNotes(familyId!); // 失敗したらDBの状態に戻す
  }
};
  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("ログアウト失敗:", error.message);
      alert("ログアウトに失敗しました");
     }else {
    // ログアウト成功後、トップページへ移動
      router.replace("/login");
    }
};
if (loading && notes.length === 0) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
      <div className="text-center">
        {/* スピナーの色を少しだけ淡く、あるいはロゴに合わせた色にするとより馴染みます */}
        <div className="animate-spin h-10 w-10 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
        {/* テキストを Loading now... に変更し、animate-pulse で「読み込み中」を演出 */}
        <p className="font-bold text-gray-500 animate-pulse tracking-widest">Loading now...</p>
      </div>
    </div>
  );
}

  return (
    <main className="min-h-screen bg-[#f8f8f8] p-4 flex flex-col gap-4">
        {/* ヘッダー (Jotaiのニックネームと、取得した招待コードを表示) */}
  <header className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-200">
    <div>
      <h1 className="text-xl font-bold text-gray-800">{nickname} さんの伝言板</h1>
      <button
      onClick={handleLogout}
      className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors border border-red-100"
    >
      ログアウト
    </button>
      {/* 招待コード（合言葉）の表示エリア */}
      <div className="mt-1 flex items-center gap-2">
        <div 
          className="bg-blue-50 border border-blue-100 px-2 py-1 rounded-md flex items-center gap-2 group cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => {
            if (inviteCode) {
              navigator.clipboard.writeText(inviteCode);
              alert("合言葉をコピーしました！お母さんに送ってね。");
            }
          }}
          title="クリックでコピー"
        >
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">合言葉</span>
          <span className="text-sm font-mono font-black text-blue-700">
            {inviteCode || "読み込み中..."}
          </span>
          {/* コピーアイコンの代わりの記号 */}
          <span className="text-[10px] text-blue-300 group-hover:text-blue-500">📋</span>
        </div>
      </div>
    </div>
    <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
    <button 
      onClick={() => setIsModalOpen(true)}
      className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
    >
      ＋ 貼る
    </button>
  </header>

      {/* 伝言板エリア */}
    <div className="flex-1 bg-white shadow-inner rounded-3xl p-6 relative border-4 border-gray-200 overflow-y-auto min-h-[500px] flex flex-wrap gap-6 items-start content-start">
  
      {notes.length === 0 && (
        <p className="text-gray-400 text-center w-full mt-20">まだメモがありません。</p>
      )}

      {notes.map((note) => (
  <div 
    key={note.id} 
    className="relative group p-4 w-64 min-h-[160px] shadow-lg rounded-sm transition-all ..."
    style={{ backgroundColor: note.color_type === 'yellow' ? '#fef3c7' : '#fff' }}
  >
    {/* --- 削除ボタンの出し分け --- */}
    {note.author_id === myId && (
      <button
        onClick={() => handleDelete(note.id, note.image_url|| null)}
        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full 
                   flex items-center justify-center shadow-md 
                   transition-opacity duration-200 
                   hover:bg-red-600 z-50 pointer-events-auto"
        title="自分のメモを剥がす"
      >
        <span className="text-lg font-bold">×</span>
      </button>
    )}

    {/* ピン留めボタン（これは全員に見えてもOK、またはこれも自分だけに絞るか検討） */}
    <button 
      onClick={() => togglePin(note.id, note.is_pinned || false)}
      className="absolute top-1 left-1 text-xl hover:scale-110 transition-transform"
    >
      {note.is_pinned ? "📌" : "📍"}
    </button>

    {/* 画像表示 */}
    {note.image_url && (
      <div className="mb-2 w-full h-24 overflow-hidden rounded-md border border-black/5">
        <img src={note.image_url} alt="" className="w-full h-full object-cover" />
      </div>
    )}

    {/* メモ内容 */}
    <p className="text-gray-800 break-words leading-relaxed">
      {note.content}
    </p>

    {/* 投稿者名ラベル */}
    <div className="mt-auto pt-2 flex justify-between items-center text-[10px] text-gray-500 font-medium">
      <span>by {note.profiles?.nickname || '誰か'}</span>
    </div>
  </div>
))}
    </div>

      {/* 投稿モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4">家族へのメモ</h2>
            <textarea
              className="w-full h-40 border-2 border-gray-300 p-4 rounded-2xl mb-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 resize-none transition-all"
              placeholder="家族にメッセージを残そう！"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            投稿モーダル内の textarea の下などに追加
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <label 
              htmlFor="image-upload" 
              className="cursor-pointer bg-gray-100 p-2 rounded-lg flex items-center gap-2 hover:bg-gray-200"
            >
            📸 {selectedFile ? "画像を選択済み" : "写真を添える"}
            </label>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 font-bold">キャンセル</button>
              <button onClick={handleSave} className="px-8 py-2 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700">貼る！</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}