# 工事部 工程表システム

工事部の案件管理・工程表を Web で一元管理するシステムです。  
管理者が案件を登録し、担当者がガントチャートに工程（作業期間）を直接クリック入力できます。A3 横 PDF 出力に対応。

## 機能概要

| 機能 | 管理者 (admin) | 担当者 (member) |
|------|:---:|:---:|
| 案件の登録・編集・削除 | ✓ | — |
| 担当者アサイン | ✓ | — |
| 全体ガントチャート閲覧 | ✓ | ✓（閲覧のみ） |
| マイ案件一覧 | ✓ | ✓ |
| 工程入力（クリック）| ✓ | ✓ |
| 出来高 (%) 更新 | ✓ | ✓ |
| 今月完了フラグ | ✓ | ✓ |
| ユーザー管理 | ✓ | — |
| PDF 出力（前半・後半） | ✓ | — |

## 技術スタック

- **フロントエンド / API**: Next.js 15 (App Router) + TypeScript
- **データベース**: Supabase (PostgreSQL) + RLS
- **認証**: Supabase Auth
- **PDF 出力**: jsPDF + html2canvas
- **スタイリング**: Tailwind CSS
- **ホスティング**: Vercel

## ガントチャート仕様

- 12ヶ月 × 4週 = **48列** の週単位ガント
- 年度: 4月〜翌3月（`fiscal_year` カラムで管理）
- 担当者ごとに色分け表示
- 1案件につき**複数工程**（飛び飛びの工期）対応
- クリック操作: セルを1回目クリック → 開始週選択 → もう1回クリック → 工程を保存
- バーをダブルクリックで工程を削除

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数を設定

`.env.local.example` をコピーして `.env.local` を作成し、Supabase の接続情報を設定します。

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Supabase にテーブルを作成

`supabase/migrations/20260616_koujitei.sql` の内容を Supabase の SQL エディタで実行します。

作成されるテーブル:

| テーブル | 説明 |
|----------|------|
| `koujitei_users` | 担当者マスタ（Supabase Auth と 1:1） |
| `koujitei_projects` | 案件マスタ |
| `koujitei_assignments` | 案件と担当者のアサイン |
| `koujitei_periods` | 工程（作業期間）複数対応 |

全テーブルに RLS を設定済みです。admin / member ロールで操作権限を制御しています。

### 4. 初期 admin ユーザーを作成

Supabase Dashboard の Authentication → Users でユーザーを作成後、SQL エディタで以下を実行:

```sql
INSERT INTO koujitei_users (id, name, role, color)
VALUES (
  '<auth.users の id>',
  '管理者名',
  'admin',
  '#4a7fff'
);
```

### 5. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスするとログイン画面に遷移します。

## Vercel へのデプロイ

1. GitHub にリポジトリを push
2. Vercel でプロジェクトをインポート
3. 環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
4. デプロイ実行

## ディレクトリ構成

```
src/
├── app/
│   ├── login/          # ログインページ
│   ├── admin/          # 管理者画面（ガント・案件管理・ユーザー管理）
│   └── member/         # 担当者画面（マイ案件・全体工程閲覧）
├── components/
│   ├── GanttChart.tsx  # ガントチャート本体
│   ├── ProjectModal.tsx # 案件登録・編集モーダル
│   └── AssignModal.tsx  # 担当者アサインモーダル
└── lib/
    ├── types.ts         # TypeScript 型定義
    ├── gantt.ts         # 週インデックス変換ユーティリティ
    └── supabase/        # Supabase クライアント（ブラウザ・サーバー）
supabase/
└── migrations/
    └── 20260616_koujitei.sql  # テーブル定義 + RLS
```

## ライセンス

MIT
