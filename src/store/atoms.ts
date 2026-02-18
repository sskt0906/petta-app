import { atom } from 'jotai';

// ユーザーのニックネームを保持する原子
export const nicknameAtom = atom<string>("");

// 所属している家族IDを保持する原子
export const familyIdAtom = atom<string | null>(null);

// 掲示板のメモ一覧を保持する原子
export const notesAtom = atom<any[]>([]);