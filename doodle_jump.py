import pygame as pg
import sys
import random
from pygame.locals import QUIT

width = 480
height = 640
size = (width, height)

class Player:
    def __init__(self):
        # player image
        image = pg.image.load("player.png")
        self.image = pg.transform.scale(image, (50, 50))
        # make the player start just above the first platform
        self.rect = self.image.get_rect(x=width/2-25, y=height-65)
        # start jumping!
        self.speed = -20
        # movement speed, how fast we move left and right
        self.ms = 10
        # lets change these to make it more readable
        self.bottom = self.rect.bottom
        self.right = self.rect.right
        self.left = self.rect.left
    def move_left(self):
        # if we can move left move left
        if self.left > 0:
            self.rect = self.rect.move(-1*self.ms, 0)
            # update these variables
            self.right = self.rect.right
            self.left = self.rect.left
    def move_right(self):
        # if we can mvoe right move right
        if self.right < width:
            self.rect = self.rect.move(self.ms, 0)
            # update these variables
            self.right = self.rect.right
            self.left = self.rect.left
    def update(self, platforms):
        # touching the floor? 
        if self.bottom > height:
            return False
        # if falling
        if self.speed > 0:
            # check if touching a platform
            for platform in platforms:
                if self.right > platform.x and self.left < (platform.x + platform.width):
                    if self.bottom > platform.y and self.bottom < (platform.y+platform.height):
            # if we are touching a platform reset the speed to jump again
                        self.speed = -20
                        self.rect = self.rect.move(0,self.speed)
            # move the rect update the variables and done
                        self.bottom = self.rect.bottom
                        return True
        # if not touching any platforms fall
        if self.speed < 10:
            # 10 is the terminal velocity
            self.speed = self.speed + 1
        # change the player y by their speed value
        self.rect = self.rect.move(0,self.speed)
        self.bottom = self.rect.bottom
        return True

class Platform:
    def __init__(self, x, y, plat_width, plat_height):
        #initialize our stuff
        self.x = x
        self.y = y
        self.width = plat_width
        self.height = plat_height

    def draw(self, surface, player):
        # if the player is on the top half of the screen
        if player.bottom < (height/2):
            # move the platforms down a bit
            self.y += 5
        # if this platform is in bounds draw it
        if self.y < height:
            pg.draw.rect(surface, "white", (self.x, self.y, self.width, self.height), 0)
            return True
        # if this platform is out of bound return False
        return False


pg.init()

DISPLAYSURF = pg.display.set_mode(size)
pg.display.set_caption('Doodle Jump')
DISPLAYSURF.fill("black")
# make a player object
player = Player()
# create our platforms list
platforms = []
# number for the score
max = 0
# string for the score
text = "score: " + str(max)
# create font object
fonts = pg.font.Font(None, 32)
# create score render/picture
score = fonts.render(text, True, "White")#, "green")
# create score rect
score_rect = pg.rect.Rect(50, 50, 100, 100)

# the starting platform covers the bottom of the screen
starting_platform = Platform(0, height-30, width, 30)
# add the starting platform
platforms.append(starting_platform)
# make some more platforms
for i in range(1,9):
    platwidth = 30
    x = random.randint(0, width-platwidth)
    platforms.append(Platform(x, height - i*100 , 30 , 10))


while True:
    for event in pg.event.get(): 
        if event.type == QUIT: 
            pg.quit()
            sys.exit()

    keys = pg.key.get_pressed()
    # get all the pressed keys

    if keys[pg.K_LEFT]:
        player.move_left()
        # if the left arrow pressed move character left
    if keys[pg.K_RIGHT]:
        player.move_right()
        # if the right arrow is pressed move characer right


    DISPLAYSURF.fill("black")
    # redraw the screen 

    if not player.update(platforms):
        # if the player has hit the floor
        continue

    # make new platforms?
    if len(platforms) < 8:
        # if there are less than x platforms make a new one
        platwidth = 30
        x = random.randint(0, width-platwidth)
        platforms.append(Platform(x, 0 , 30 , 10))

    #draw platforms if they are inbounds 
    for platform in platforms:
        if not platform.draw(DISPLAYSURF, player):
            # if the platform was out of bounds increase the score
            platforms.remove(platform)
            max += 1
            text = "score: " + str(max)
            score = fonts.render(text, True, "White")#, "green")


    # blitt the character
    DISPLAYSURF.blit(player.image, player.rect)
    # blitt the score
    DISPLAYSURF.blit(score, score_rect)
    # 60 frames a second
    pg.time.Clock().tick(60)
    # update the frame
    pg.display.update()
    