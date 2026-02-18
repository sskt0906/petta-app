// src/types/database.ts

export type Note = {
  id: string;          // UUID
  family_id: string;   // どの家族のメモか
  author_id: string;   // 誰が書いたか
  content: string;     // メモの内容
  content_type: 'text' | 'image' | 'audio'; // メモの種類
  x_position: number;  // 画面のどの位置（横）にあるか
  y_position: number;  // 画面のどの位置（縦）にあるか
  color_type: string;  // 付箋の色
  created_at: string;  // 作成日時
  is_pinned: boolean;   // ピン留めされているか
  image_url?: string | null; // 画像メモのURL
  profiles?: {
    nickname: string | null; //profilesテーブルから合流してくるデータの型
  };
};

export type Profile = {
  id: string;
  family_id: string | null;
  nickname: string | null;
  avatar_url: string | null;
};