// The China section (/china): China's two-wheeler market as a section of its own, with its policy first.
import { defineModule } from "@hotmoto/contracts/modules";

export default defineModule({
  name: "china",
  pages: [{ path: "china", file: "web/china.tsx" }],
});
