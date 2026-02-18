# Petta（ペッタ）- 家族のデジタル掲示板

家族が毎日必ず見るリアルタイム共有掲示板です。
難しい操作は一切なし。メールアドレスだけでログインし、家族共通の合言葉でつながります。

## 主な機能
- **マジックリンク認証**: パスワード不要、メールのリンクをタップするだけでログイン。
- **独自招待システム**: 8桁の「合言葉」を発行・入力することで、家族のボードに即座に参加。
- **リアルタイム同期**: 誰かが付箋を貼ったり剥がしたりすると、家族全員の画面が瞬時に更新。
- **写真共有**: メッセージと一緒に写真を「ペタッ」と貼れる機能。

## 技術スタック
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **State Management**: Jotai
- **Backend/Infrastructre**: Supabase
  - Auth (Magic Link)
  - Database (PostgreSQL)
  - Realtime (Postgres Changes)
  - Storage (Image hosting)
- **Deployment**: Vercel

## システム設計のこだわり
### 1. ユーザーを迷わせない「関所」ロジック
MiddlewareとNext.jsの`useEffect`を組み合わせ、ログイン直後のプロフィール未設定ユーザーを確実にセットアップ画面へ誘導するルーティングを設計しました。

### 2. 独自招待フロー
URL共有ではなく、家族間での会話を想定した「合言葉形式」を採用。DBの制約（Foreign Key）を活かしつつ、`upsert`処理によって不整合の起きないメンバー紐付けを実装しています。

### 3. ストレージ管理の最適化
付箋（レコード）を削除した際、DBからデータを消すだけでなく、Supabase Storageに保存された画像実体も自動でクリーンアップするロジックを組み込み、リソースの無駄遣いを防止しています。


erDiagram
    %% Supabaseの内部テーブル
    auth_users ||--|| profiles : "id = id"
    
    %% アプリ専用テーブル
    families ||--o{ profiles : "joined by invite_code"
    families ||--o{ notes : "owns"
    profiles ||--o{ notes : "creates"

    families {
        uuid id PK
        string family_name "ニックネームの家"
        string invite_code "UK / 8桁ランダム"
        timestamp created_at
    }

    profiles {
        uuid id PK "FK to auth.users"
        uuid family_id FK "どの家族か"
        string nickname "表示名"
        timestamp updated_at
    }

    notes {
        uuid id PK
        uuid family_id FK
        uuid author_id FK
        text content "メッセージ本文"
        string image_url "Storageパス"
        boolean is_pinned "ピン留め機能"
        timestamp created_at
    }