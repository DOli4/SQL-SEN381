using System;

namespace CampusLearn.Models
{
    public class Role
    {
        public Guid RoleId { get; private set; }
        public string Name { get; private set; }
        public string Description { get; private set; }

        public Role(string name, string description = null)
        {
            RoleId = Guid.NewGuid();
            Name = name;
            Description = description;
        }

        public void Rename(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName)) throw new ArgumentException("Role name required.");
            Name = newName;
        }

        public void UpdateDescription(string description)
        {
            Description = description;
        }
    }
}
