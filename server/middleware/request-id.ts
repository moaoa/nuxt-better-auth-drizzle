
import { v4 as uuidv4 } from 'uuid';

export default defineEventHandler((event) => {
  const reqId = uuidv4();
  event.context.reqId = reqId;
});
