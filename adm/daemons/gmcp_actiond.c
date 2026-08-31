#include <globals.h>

// Source trees are not readable from a player object.  Keep action discovery
// in a root-owned daemon and return only safe method names to GMCP callers.

private int safe_skill_id(string value)
{
    int i;

    if (!stringp(value) || value == "" || strlen(value) > 64)
        return 0;
    for (i = 0; i < strlen(value); i++)
    {
        if ((value[i] >= 'a' && value[i] <= 'z') ||
            (value[i] >= '0' && value[i] <= '9') ||
            value[i] == '-' || value[i] == '_')
            continue;
        return 0;
    }
    return 1;
}

void create()
{
    seteuid(ROOT_UID);
}

string *query_action_names(string skill, string directory)
{
    mixed *names;
    string *result;
    string name;
    string path;
    int i;

    if (!safe_skill_id(skill) ||
        file_size(SKILL_D(skill) + ".c") < 0)
        return ({});
    if (directory != "" && directory != "perform/" &&
        directory != "exert/")
        return ({});

    path = SKILL_D(skill) + "/" + directory;
    names = get_dir(path + "*.c");
    result = ({});
    if (!pointerp(names))
        return result;
    for (i = 0; i < sizeof(names); i++)
    {
        name = names[i];
        if (!stringp(name) || strlen(name) < 3 ||
            name[strlen(name) - 2..] != ".c")
            continue;
        name = name[0..strlen(name) - 3];
        if (safe_skill_id(name))
            result += ({name});
    }
    return sort_array(result, (: strcmp :));
}
