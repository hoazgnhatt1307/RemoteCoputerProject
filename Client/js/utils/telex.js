/**
 * TELEX UTILS MODULE
 * Xử lý logic bỏ dấu tiếng Việt (Telex) cho Keylogger.
 */

const TELEX_MAPPING = {
    aw: "ă", aa: "â", dd: "đ", ee: "ê", oo: "ô", ow: "ơ", uw: "ư",
    uow: "ươ", uwo: "ươ",
    tone: { s: 1, f: 2, r: 3, x: 4, j: 5 }
};

const VOWEL_TABLE = [
    ["a", "á", "à", "ả", "ã", "ạ"], ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
    ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"], ["e", "é", "è", "ẻ", "ẽ", "ẹ"],
    ["ê", "ế", "ề", "ể", "ễ", "ệ"], ["i", "í", "ì", "ỉ", "ĩ", "ị"],
    ["o", "ó", "ò", "ỏ", "õ", "ọ"], ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"],
    ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"], ["u", "ú", "ù", "ủ", "ũ", "ụ"],
    ["ư", "ứ", "ừ", "ử", "ữ", "ự"], ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"]
];

export const TelexEngine = {
    apply(text, char) {
        if (char === "<BACK>") return text.slice(0, -1);
        if (char === "<ENTER>") return text + "\n";
        if (char === "<TAB>") return text + "    ";
        
        // Chỉ xử lý nếu là ký tự chữ/số
        if (!/^[a-zA-Z0-9]$/.test(char)) return text + char;

        // Tách từ cuối cùng để xử lý
        let lastSpace = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"));
        let prefix = text.substring(0, lastSpace + 1);
        let word = text.substring(lastSpace + 1);
        let lowerChar = char.toLowerCase();

        // 1. Xử lý Dấu thanh (s, f, r, x, j)
        if (TELEX_MAPPING.tone[lowerChar]) {
            let toneMark = TELEX_MAPPING.tone[lowerChar];
            let toneInfo = this.findToneInWord(word);
            
            if (toneInfo) {
                let [idx, currentTone, base] = toneInfo;
                if (currentTone === toneMark) {
                    // Gõ trùng dấu -> Bỏ dấu (Undo)
                    return prefix + this.replaceChar(word, idx, base) + char;
                } else {
                    // Gõ dấu khác -> Đổi dấu
                    let newChar = this.getCharWithTone(base, toneMark);
                    if(word[idx] === word[idx].toUpperCase()) newChar = newChar.toUpperCase();
                    return prefix + this.replaceChar(word, idx, newChar);
                }
            } else {
                // Chưa có dấu -> Thêm dấu
                let targetIdx = this.findVowelToPlaceTone(word);
                if (targetIdx !== -1) {
                    let base = word[targetIdx];
                    let newChar = this.getCharWithTone(base, toneMark);
                    if(base === base.toUpperCase()) newChar = newChar.toUpperCase();
                    return prefix + this.replaceChar(word, targetIdx, newChar);
                }
            }
        }

        // 2. Xử lý ký tự kép (aa, dd, ee...) & w
        // (Giữ nguyên logic cũ nhưng viết gọn lại)
        let combined = word + char;
        
        // Xử lý 'uow' -> 'ươ'
        let last3 = combined.slice(-3).toLowerCase();
        if(last3 === 'uow' || last3 === 'uwo') return prefix + combined.slice(0, -3) + "ươ";

        let last2 = combined.slice(-2).toLowerCase();
        
        // Revert logic (đ + d -> dd...)
        if(lowerChar === 'd' && word.endsWith('đ')) return prefix + word.slice(0, -1) + "dd";
        if(lowerChar === 'a' && word.endsWith('â')) return prefix + word.slice(0, -1) + "aa";
        
        // Create logic (a + a -> â...)
        if(TELEX_MAPPING[last2]) {
             let replace = TELEX_MAPPING[last2];
             let first = combined.slice(-2)[0];
             if(first === first.toUpperCase()) replace = replace.toUpperCase();
             return prefix + word.slice(0, -1) + replace;
        }

        // Xử lý 'w' (u+w -> ư, o+w -> ơ, a+w -> ă)
        if(lowerChar === 'w') {
            let last = word.slice(-1);
            let map = {'u':'ư', 'o':'ơ', 'a':'ă'};
            if(map[last.toLowerCase()]) {
                 let replace = map[last.toLowerCase()];
                 if(last === last.toUpperCase()) replace = replace.toUpperCase();
                 return prefix + word.slice(0, -1) + replace;
            }
        }

        return text + char;
    },

    // --- Helpers ---
    findToneInWord(word) {
        for(let i=0; i<word.length; i++) {
            let c = word[i].toLowerCase();
            for(let row of VOWEL_TABLE) {
                for(let t=1; t<row.length; t++) {
                    if(row[t] === c) return [i, t, row[0]];
                }
            }
        }
        return null;
    },

    findVowelToPlaceTone(word) {
        let lw = word.toLowerCase();
        if(lw.includes("ươ")) return lw.indexOf("ươ") + 1;
        
        const priority = ["ê", "ô", "ơ", "â", "ă", "ư"];
        for(let i=0; i<lw.length; i++) if(priority.includes(lw[i])) return i;
        
        const exceptions = ["oa", "oe", "uy"];
        for(let ex of exceptions) if(lw.includes(ex)) return lw.indexOf(ex) + 1;
        
        let start = (lw.startsWith("qu") || lw.startsWith("gi")) && /[ueoaiy]/.test(lw.slice(2)) ? 2 : 0;
        const normal = ["a", "e", "o", "u", "i", "y"];
        for(let i=start; i<lw.length; i++) if(normal.includes(lw[i])) return i;
        
        return -1;
    },

    getCharWithTone(base, toneIdx) {
        for(let row of VOWEL_TABLE) if(row[0] === base.toLowerCase()) return row[toneIdx];
        return base;
    },

    replaceChar(str, idx, replacement) {
        return str.substring(0, idx) + replacement + str.substring(idx + 1);
    }
};