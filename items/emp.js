module.exports = {
    data: {
        name: 'emp',
    },
    async use(message, args) {
        let target;
        try {
            target = await message.guild.members.fetch("1030224702939070494");
        } catch (error) {
            throw new Error(`Couldn't fetch user with id: ${"1030224702939070494"}`);
        }

        try {
	        target.timeout(999999999);
            message.channel.send(`<@${target.id}> has been disabled. Use the battery to enable her again!`);
        } catch (error) {
            throw new Error('Error disabling nexxy.');
        }
    }
}
