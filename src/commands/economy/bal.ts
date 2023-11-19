import { Message, EmbedBuilder, inlineCode } from 'discord.js';
import { Users } from '../../database/db-objects';
import { Commands as Command, CommandsCommandId } from '../../database/schemas/public/Commands';
import { CURRENCY_EMOJI_CODE, formatNumber } from '../../utilities';

const data: Command = {
    command_id: 'bal' as CommandsCommandId,
    description: `View your balance`,
    usage: `${inlineCode("$bal")}`,
    cooldown_time: 0,
    is_admin: false
};

export default {
    data: data,
    async execute(message: Message, args: string[]): Promise<void> {
        try {
            const authorBalance = await Users.getBalance(message.author.id);

            throw new Error("test");
            const embed = new EmbedBuilder()
                .setColor("Blurple")
                .addFields({ value: `${CURRENCY_EMOJI_CODE} ${formatNumber(authorBalance)}`, name: `Balance` });

            await message.reply({ embeds: [embed] });            
        }
        catch (error) {
            console.error('An error occurred: ', error);

            const embed = new EmbedBuilder()
                .setColor("Yellow")
                .setFields({
                    name: `An error occurred when getting your balance. Please try again later.`,
                    value: ``
                });

            await message.reply({ embeds: [embed] });
        }
	},
};
