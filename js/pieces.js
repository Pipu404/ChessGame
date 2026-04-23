/**
 * PIECE IMAGES — Maps piece type+color to image file paths.
 *
 * Files in /assets:
 *   Black: B_bishop.png, B_king.png, B_knight.png, B_pawn.png, B_queen.png, B_rook.png
 *   White: W_Bishop.png, W_king.png, W_knight.png, W_pawn.png, W_queen.png, W_rook.png
 *
 * Engine piece types: p, r, n, b, q, k  |  colors: w, b
 */
const PIECE_IMAGES = {
  // Black pieces
  'bp': 'assets/B_pawn.png',
  'br': 'assets/B_rook.png',
  'bn': 'assets/B_knight.png',
  'bb': 'assets/B_bishop.png',
  'bq': 'assets/B_queen.png',
  'bk': 'assets/B_king.png',
  // White pieces
  'wp': 'assets/W_pawn.png',
  'wr': 'assets/W_rook.png',
  'wn': 'assets/W_knight.png',
  'wb': 'assets/W_Bishop.png',  // note: capital B in filename
  'wq': 'assets/W_queen.png',
  'wk': 'assets/W_king.png',
};

/**
 * Returns an <img> tag HTML string for the given piece type and color.
 * Used by ui.js to render pieces on the board.
 */
function getPieceSVG(type, color) {
  const key = color + type;
  const src = PIECE_IMAGES[key];
  if (!src) return '';
  return `<img src="${src}" alt="${color}${type}" draggable="false"
    style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;" />`;
}
