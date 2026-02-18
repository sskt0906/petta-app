import { createClient } from '@supabase/supabase-js'

// .env.localから環境変数を読み込む（!は「絶対にあるよ」というTypeScriptへの合図）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Supabaseと通信するための窓口を作成
export const supabase = createClient(supabaseUrl, supabaseAnonKey)