import { Message, inlineCode } from 'discord.js';
import { findTextArgs } from '../utilities';
import { Items as Item, ItemsItemId } from '../database/schemas/public/Items';

const data: Item = {
    item_id: 'megaphone' as ItemsItemId,
    price: 20000,
    emoji_code: ":mega:",
    description: "Sends your message and/or attachment as an @everyone",
    usage: `${inlineCode("$use megaphone [message/attachment]")}\n${inlineCode("$use megaphone [message] [attachment]")}`
};

export default {
    data: data,
    async use(message: Message, args: string[]): Promise<void> {
        const msgToSend = findTextArgs(args).join(" ");

        const attachmentsArray = [...message.attachments.values()];

        if (!msgToSend && message.attachments.size === 0) {
            throw new Error("You need to provide a message or an attachment.");
        }

        try {
            await message.delete();
        } catch (error) {
            throw new Error("Failed to delete message.");
        }

        await message.channel.send({
            content: msgToSend ? `@everyone\n\n <@${message.author.id}> says: ${msgToSend}` : '@everyone',
            files: attachmentsArray,
        });
    }
}
